import { NextResponse } from "next/server";
import { findOrderByFalcoCode } from "@/lib/db";
import { getTrackingSiteBySlug } from "@/lib/ctv-portal";
import { loadPublicTracking, whiteLabel } from "@/lib/public-tracking";

export const dynamic = "force-dynamic";

// Tra cứu trên trang thương hiệu riêng của FWD: chỉ trả đơn thuộc đúng FWD đó, dữ liệu đã bỏ mọi dấu vết Falco/đối tác.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const code = (new URL(request.url).searchParams.get("code") ?? "").trim();
  if (!code) return NextResponse.json({ error: "Thiếu mã vận đơn" }, { status: 400 });

  const site = await getTrackingSiteBySlug(slug);
  if (!site || !site.enabled) return NextResponse.json({ found: false, data: null });

  try {
    const order = await findOrderByFalcoCode(code);
    if (!order || order.ctv_id !== site.ctv_id || order.review_status === "rejected") {
      return NextResponse.json({ found: false, data: null });
    }
    return NextResponse.json({ found: true, data: whiteLabel(await loadPublicTracking(order)) });
  } catch (err) {
    console.error("[t/track] Lỗi:", err);
    return NextResponse.json({ error: "Không thể tra cứu lúc này, vui lòng thử lại sau." }, { status: 500 });
  }
}
