import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { invalidateAdminStaffCache } from "@/lib/admin-staff-check";
import { deleteAdminUser, listAdminUsers } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json(
      { error: "Chỉ chủ tài khoản mới có thể xoá tài khoản nhân viên" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  // Không cho tự xoá tài khoản đang đăng nhập hoặc xoá tài khoản chủ khác.
  const staff = await listAdminUsers();
  const target = staff.find((s) => s.id === targetId);
  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }
  if (target.email === session.email) {
    return NextResponse.json(
      { error: "Không thể tự xoá tài khoản đang đăng nhập" },
      { status: 400 }
    );
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Không thể xoá tài khoản chủ tài khoản" },
      { status: 403 }
    );
  }

  const ok = await deleteAdminUser(targetId);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }

  invalidateAdminStaffCache(target.email);
  return NextResponse.json({ ok: true });
}
