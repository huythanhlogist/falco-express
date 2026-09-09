import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { updatePolicyItem, deletePolicyItem } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Nội dung không được để trống" }, { status: 400 });
  }
  await updatePolicyItem(Number(id), content);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await deletePolicyItem(Number(id));
  if (!ok) return NextResponse.json({ error: "Không tìm thấy mục chính sách" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
