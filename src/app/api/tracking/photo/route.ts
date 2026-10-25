import { NextResponse } from "next/server";
import { findOrderByFalcoCode, getTrackingCache } from "@/lib/db";
import { UUID_RE, fetchBayImage, readSavedImage } from "@/lib/bay-images";
import { parseCachedKango } from "@/lib/tracking-cache";

// Ảnh hàng của đơn FEB… cho khách: /api/tracking/photo?code=FEB…&n=<số thứ tự>.
// Khách chỉ thấy mã đơn + số thứ tự — không có địa chỉ nguồn ảnh. Id ảnh nằm trong cache
// tracking phía server. Chỉ phục vụ ảnh thuộc đúng đơn đó.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").trim();
  const n = Number(searchParams.get("n"));
  if (!code.toUpperCase().startsWith("FEB") || !Number.isInteger(n) || n < 0) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }

  const order = await findOrderByFalcoCode(code);
  if (!order) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const cache = await getTrackingCache(order.id, order.awb).catch(() => null);
  const kango = cache ? parseCachedKango(cache) : null;
  const id = kango?.falco_photos?.[n]?.id;
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 });

  const headers = { "Cache-Control": "public, max-age=86400" };
  const saved = await readSavedImage(id);
  if (saved) return new Response(new Uint8Array(saved.data), { headers: { ...headers, "Content-Type": saved.type } });

  try {
    const upstream = await fetchBayImage(id);
    const type = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !type.startsWith("image/")) {
      return NextResponse.json({ error: "Không lấy được ảnh" }, { status: 502 });
    }
    return new Response(upstream.body, { headers: { ...headers, "Content-Type": type } });
  } catch {
    return NextResponse.json({ error: "Không lấy được ảnh" }, { status: 502 });
  }
}
