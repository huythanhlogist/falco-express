import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { deleteIntakeOrder } from "@/lib/google-drive";

export async function DELETE(_request: Request, { params }: { params: Promise<{ folderId: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { folderId } = await params;
  try {
    await deleteIntakeOrder(folderId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Xoá thất bại" },
      { status: 500 }
    );
  }
}
