import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { deleteAdminUser, listAdminUsers } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentAdminSession();
  if (session?.role !== "owner") {
    return NextResponse.json(
      { error: "Chỉ chủ tài khoản mới có thể xoá tài khoản nhân viên" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  // Không cho tự xoá tài khoản đang đăng nhập, tránh tự khoá quyền truy cập.
  const staff = await listAdminUsers();
  const target = staff.find((s) => s.id === targetId);
  if (target && target.email === session.email) {
    return NextResponse.json(
      { error: "Không thể tự xoá tài khoản đang đăng nhập" },
      { status: 400 }
    );
  }

  const ok = await deleteAdminUser(targetId);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
