import { NextResponse } from "next/server";
import { getAttentionAlerts } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

/**
 * Trả về số lượng và danh sách tối đa 10 đơn "Cần chú ý" cho chuông cảnh báo (AlertBell).
 * Đăng nhập admin đã được src/proxy.ts kiểm tra toàn cục cho mọi route /api/admin/*.
 */
export async function GET() {
  try {
    const data = await getAttentionAlerts(10);
    return NextResponse.json(
      {
        count: data.count,
        items: data.items,
        updatedAt: data.updatedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("[dashboard/alerts] Lỗi lấy danh sách cảnh báo:", err);
    return NextResponse.json(
      { error: "Không tải được danh sách cảnh báo" },
      { status: 500 }
    );
  }
}
