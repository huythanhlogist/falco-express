import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { deleteCtvContentItem, updateCtvContentItem } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const { title, content } = await request.json();
  const ok = await updateCtvContentItem(Number(id), {
    title: typeof title === "string" ? title.trim() : undefined,
    content: typeof content === "string" ? content.trim() : undefined,
  });
  if (!ok) return NextResponse.json({ error: "Không tìm thấy mục này" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteCtvContentItem(Number(id));
  if (!ok) return NextResponse.json({ error: "Không tìm thấy mục này" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
