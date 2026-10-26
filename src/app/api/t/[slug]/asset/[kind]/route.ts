import { NextResponse } from "next/server";
import { getTrackingSiteImage } from "@/lib/ctv-portal";

export const dynamic = "force-dynamic";

// Logo / banner của trang FWD, phục vụ qua đường dẫn của chính trang đó.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; kind: string }> }) {
  const { slug, kind } = await params;
  if (kind !== "logo" && kind !== "banner") return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const img = await getTrackingSiteImage(slug, kind);
  if (!img) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=300" },
  });
}
