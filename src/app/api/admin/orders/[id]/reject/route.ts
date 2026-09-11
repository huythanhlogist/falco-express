import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { rejectOrder } from "@/lib/db";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await rejectOrder(Number(id), session.email);
  if (!ok) {
    return NextResponse.json(
      { error: "Không tìm thấy đơn đang chờ duyệt này" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
