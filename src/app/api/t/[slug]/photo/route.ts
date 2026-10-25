import { NextResponse } from "next/server";
import { getTrackingSiteBySlug } from "@/lib/ctv-portal";
import { servePhoto } from "@/lib/tracking-photo";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getTrackingSiteBySlug(slug);
  if (!site || !site.enabled) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  const sp = new URL(request.url).searchParams;
  return servePhoto((sp.get("code") ?? "").trim(), Number(sp.get("n")), site.ctv_id);
}
