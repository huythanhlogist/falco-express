import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { baselineShipmentEvents } from "@/lib/shipment-notify";

export const dynamic = "force-dynamic";

/**
 * Chạy 1 lần khi bật luồng thông báo Zalo: quét toàn bộ sự kiện hiện có
 * rồi đánh dấu đã gửi hết (notified_at = NOW()) để tránh gửi dồn tin cũ.
 * Chỉ phiên đăng nhập admin có quyền owner mới được gọi.
 */
export async function POST() {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json(
      { error: "Chỉ chủ tài khoản mới có quyền chạy baseline thông báo" },
      { status: 403 }
    );
  }

  try {
    const result = await baselineShipmentEvents();
    return NextResponse.json(
      { ok: true, ...result },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("[admin/notify/baseline] Lỗi chạy baseline thông báo:", err);
    return NextResponse.json(
      { error: "Không chạy được baseline thông báo" },
      { status: 500 }
    );
  }
}
