import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findKangoBillImageById } from "@/lib/db";
import { deleteKangoBillImageIfDraft, isValidAgentKey } from "@/lib/kango-bill-db";
import { parsePositiveId } from "@/lib/kango-bill-validate";

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

  const outcome = await deleteKangoBillImageIfDraft(id);
  if (outcome === "not_found") {
    return NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 });
  }
  if (outcome === "locked") {
    return NextResponse.json(
      { error: "Không thể xoá ảnh của bill đã gửi hoặc đang gửi lên Kango" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
