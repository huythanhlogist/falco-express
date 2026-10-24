import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { UUID_RE, fetchBayImage, readSavedImage } from "@/lib/bay-images";

// Ảnh BayOnline qua tên miền Falco: ưu tiên bản đã lưu trên server, không có thì
// chuyển tiếp từ Bay (không lưu). Chỉ admin xem được.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Mã ảnh không hợp lệ" }, { status: 400 });
  const headers = { "Cache-Control": "private, max-age=86400" };

  const saved = await readSavedImage(id.toLowerCase());
  if (saved) {
    return new Response(new Uint8Array(saved.data), { headers: { ...headers, "Content-Type": saved.type, "X-Image-Source": "saved" } });
  }

  try {
    const upstream = await fetchBayImage(id.toLowerCase());
    const type = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !type.startsWith("image/")) {
      return NextResponse.json({ error: "Không lấy được ảnh" }, { status: upstream.status === 404 ? 404 : 502 });
    }
    return new Response(upstream.body, { headers: { ...headers, "Content-Type": type, "X-Image-Source": "proxy" } });
  } catch {
    return NextResponse.json({ error: "Không kết nối được tới BayOnline" }, { status: 502 });
  }
}
