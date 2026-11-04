import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { fetchOfficeWithRetry } from "@/lib/n8n-office-fetch";

export const dynamic = "force-dynamic";

// Trạng thái thật cho trang /admin/van-phong: n8n tổng hợp hàng đợi Muse,
// nhịp sống bot và lead chờ duyệt. Khóa chỉ nằm ở biến môi trường server.
export async function GET() {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  }

  const key = process.env.N8N_OFFICE_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Chưa cấu hình N8N_OFFICE_KEY trên server" },
      { status: 503 },
    );
  }
  const base = (process.env.N8N_BASE_URL || "https://n8n.falcoexpress.com").trim();

  const r = await fetchOfficeWithRetry(
    `${base}/webhook/office/status`,
    { headers: { "x-api-key": key }, cache: "no-store" },
    "status",
  );
  if (r.status === 401 || r.status === 403) {
    return NextResponse.json(
      { ok: false, error: "Khóa N8N_OFFICE_KEY trên server không khớp với n8n (kiểm tra dán nhầm khóa hoặc thừa khoảng trắng)" },
      { status: 502 },
    );
  }
  return NextResponse.json(r.body, { status: r.status });
}
