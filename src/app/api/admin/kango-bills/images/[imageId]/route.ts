import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { deleteKangoBillImage, findKangoBillImageById } from "@/lib/db";

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  return Boolean(key && expected && key === expected);
}

function parsePositiveId(raw: string): number | null {
  const num = Number(raw);
  return Number.isInteger(num) && num > 0 ? num : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { imageId } = await params;
  const id = parsePositiveId(imageId);
  if (!id) {
    return NextResponse.json({ error: "ID ảnh không hợp lệ" }, { status: 400 });
  }

  const image = await findKangoBillImageById(id);
  if (!image) {
    return NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime_type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { imageId } = await params;
  const id = parsePositiveId(imageId);
  if (!id) {
    return NextResponse.json({ error: "ID ảnh không hợp lệ" }, { status: 400 });
  }

  const ok = await deleteKangoBillImage(id);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
