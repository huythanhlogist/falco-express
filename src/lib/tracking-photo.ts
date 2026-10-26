import { NextResponse } from "next/server";
import { findOrderByFalcoCode, getTrackingCache } from "./db";
import { UUID_RE, fetchBayImage, readSavedImage } from "./bay-images";
import { parseCachedKango } from "./tracking-cache";

/**
 * Phục vụ ảnh hàng của đơn FEB… cho khách theo (mã đơn, số thứ tự) — không lộ địa chỉ nguồn ảnh.
 * ownerCtvId: khi gọi từ trang thương hiệu FWD thì đơn phải thuộc FWD đó.
 */
export async function servePhoto(code: string, n: number, ownerCtvId?: number): Promise<Response> {
  if (!code.toUpperCase().startsWith("FEB") || !Number.isInteger(n) || n < 0) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const order = await findOrderByFalcoCode(code);
  if (!order || (ownerCtvId !== undefined && order.ctv_id !== ownerCtvId)) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }
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
