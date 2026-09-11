import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { deleteAiIntakeOrder } from "@/lib/db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteAiIntakeOrder(Number(id));
  if (!ok) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
