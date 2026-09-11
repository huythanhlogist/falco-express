import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findAiIntakeImageById } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { imageId } = await params;
  const image = await findAiIntakeImageById(Number(imageId));
  if (!image) return NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 });

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime_type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
