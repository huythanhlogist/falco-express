import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { buildPendingMessages, isValidNotifyAgentKey } from "@/lib/shipment-notify";
import { refreshLastMileFast } from "@/lib/last-mile-fast-refresh";

export const dynamic = "force-dynamic";

/**
 * Trả về các tin nhắn thông báo Zalo đang chờ gửi cho n8n.
 * - Cho phép cả phiên admin và agent ngoài (header x-agent-api-key, đã mở ở src/proxy.ts).
 * - Query `?preview=1`: vẫn dựng và trả tin kể cả trong khung giờ im lặng 22:00–07:00 VN,
 *   KHÔNG đánh dấu notified_at.
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidNotifyAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const preview = request.nextUrl.searchParams.get("preview") === "1";

  try {
    // Làn nhanh: lấy lại tracking các đơn chặng cuối cũ nhất để tin "Sắp giao"/"Đã giao" đến sớm.
    // Lỗi ở bước này không chặn việc trả tin.
    if (!preview) {
      await refreshLastMileFast().catch((err) => console.error("[admin/notify/pending] Làn nhanh lỗi:", err));
    }
    const data = await buildPendingMessages({ ignoreQuiet: preview });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin/notify/pending] Lỗi lấy danh sách thông báo chờ gửi:", err);
    return NextResponse.json(
      { error: "Không tải được danh sách thông báo chờ gửi" },
      { status: 500 }
    );
  }
}
