import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findDbnQuoteImageById } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const image = await findDbnQuoteImageById(Number(id));
  if (!image) return NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 });

  return new NextResponse(new Uint8Array(image), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
