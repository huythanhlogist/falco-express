import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findAiIntakeImageById } from "@/lib/db";

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  return Boolean(key && expected && key === expected);
}

export async function GET(request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

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
