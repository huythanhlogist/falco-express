import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Trạng thái thật cho trang /admin/van-phong: n8n tổng hợp hàng đợi Muse,
// nhịp sống bot và lead chờ duyệt. Khóa chỉ nằm ở biến môi trường server.
export async function GET() {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  }

  const key = process.env.N8N_OFFICE_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Chưa cấu hình N8N_OFFICE_KEY trên server" },
      { status: 503 },
    );
  }
  const base = process.env.N8N_BASE_URL || "https://n8n.falcoexpress.com";

  try {
    const res = await fetch(`${base}/webhook/office/status`, {
      headers: { "x-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `n8n trả về ${res.status}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Không kết nối được n8n" },
      { status: 502 },
    );
  }
}
