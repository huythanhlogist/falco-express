import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { DhlConfigError } from "@/lib/dhl-tracking";
import { refreshDhlLastMile } from "@/lib/last-mile-sync";

export const dynamic = "force-dynamic";

const DEFAULT_MAX_CALLS = 10;
const MAX_ALLOWED_CALLS = 50;

// Route này nằm ngoài matcher xác thực admin trong src/proxy.ts — được bảo vệ
// riêng bằng CRON_SECRET giống /api/cron/refresh-tracking.
function isValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function parseMaxCalls(raw: string | null): number {
  if (!raw) return DEFAULT_MAX_CALLS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_MAX_CALLS;
  return Math.min(n, MAX_ALLOWED_CALLS);
}

let running = false;

/**
 * POST /api/cron/refresh-last-mile
 *   Cron chạy mỗi giờ × 10 lượt = tối đa 240 lượt/ngày (< hạn mức 250 lượt/ngày miễn phí của DHL).
 *   Mặc định: chạy xong (tối đa ~50-60s cho 10 mã) và trả JSON tóm tắt.
 *   ?maxCalls=<n>: điều chỉnh số lượt gọi tối đa cho 1 phiên chạy (mặc định 10, trần 50).
 *   ?background=1: trả 202 ngay và chạy nền nếu hệ thống cron có timeout ngắn.
 */
export async function POST(request: Request) {
  if (!isValidCronSecret(request)) {
    return NextResponse.json({ error: "Không hợp lệ" }, { status: 401 });
  }
  if (running) {
    return NextResponse.json({ error: "Đang có một lượt đồng bộ DHL chặng cuối khác chạy" }, { status: 409 });
  }

  const searchParams = new URL(request.url).searchParams;
  const maxCalls = parseMaxCalls(searchParams.get("maxCalls"));
  const background = searchParams.get("background") === "1";

  running = true;

  if (background) {
    void refreshDhlLastMile({ maxCalls })
      .then((summary) => console.log("[cron/refresh-last-mile] Xong:", summary))
      .catch((err) => console.error("[cron/refresh-last-mile] Lỗi:", err))
      .finally(() => {
        running = false;
      });
    return NextResponse.json({ started: true, maxCalls }, { status: 202 });
  }

  try {
    const summary = await refreshDhlLastMile({ maxCalls });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[cron/refresh-last-mile] Lỗi:", err);
    if (err instanceof DhlConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Làm mới tracking chặng cuối DHL thất bại" }, { status: 500 });
  } finally {
    running = false;
  }
}
