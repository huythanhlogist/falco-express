import { NextResponse } from "next/server";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { findOrderById } from "@/lib/db";
import { servePhoto } from "@/lib/tracking-photo";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { id } = await params;
  const order = await findOrderById(Number(id));
  if (!order || order.ctv_id !== session.ctvId) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  return servePhoto(order.falco_code, Number(new URL(request.url).searchParams.get("n")), session.ctvId);
}
