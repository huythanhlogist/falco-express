import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { isBayConfigured } from "@/lib/bay-api";
import { syncBayShipments } from "@/lib/bay-sync";
import { refreshTrackingCache } from "@/lib/tracking-cache";

export const dynamic = "force-dynamic";

// Route này nằm ngoài matcher của src/proxy.ts (không cần phiên admin) —
// được bảo vệ riêng bằng CRON_SECRET, để cron của hosting gọi mỗi ngày.
function isValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

let running = false;

// Đồng bộ vận đơn BayOnline → đơn FEB… trước khi làm mới tracking, để đơn mới của Bay có mã ngay.
// Lỗi phía Bay không được chặn việc làm mới tracking Kango.
async function syncBaySafely() {
  if (!isBayConfigured()) return null;
  try {
    return await syncBayShipments();
  } catch (err) {
    console.error("[cron/refresh-tracking] Đồng bộ BayOnline lỗi:", err);
    return null;
  }
}

/**
 * POST /api/cron/refresh-tracking
 *   Mặc định: trả 202 ngay và chạy nền (tránh curl của cron bị timeout).
 *   ?wait=1: chạy xong mới trả kết quả — dùng khi chạy tay/backfill.
 */
export async function POST(request: Request) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json({ error: "Không hợp lệ" }, { status: 401 });
  }
  if (running) {
    return NextResponse.json({ error: "Đang có một lượt làm mới khác chạy" }, { status: 409 });
  }

  const wait = new URL(request.url).searchParams.get("wait") === "1";
  running = true;

  if (wait) {
    try {
      const bayResult = await syncBaySafely();
      const summary = await refreshTrackingCache();
      return NextResponse.json({ ok: true, ...summary, bayCreated: bayResult?.created.length ?? null });
    } catch (err) {
      console.error("[cron/refresh-tracking] Lỗi:", err);
      return NextResponse.json({ error: "Làm mới thất bại" }, { status: 500 });
    } finally {
      running = false;
    }
  }

  void syncBaySafely()
    .then(() => refreshTrackingCache())
    .then((summary) => console.log("[cron/refresh-tracking] Xong:", summary))
    .catch((err) => console.error("[cron/refresh-tracking] Lỗi:", err))
    .finally(() => {
      running = false;
    });

  return NextResponse.json({ started: true }, { status: 202 });
}
