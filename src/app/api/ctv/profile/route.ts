import { NextResponse } from "next/server";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { findCtvById, updateCtvUser } from "@/lib/db";

export async function GET() {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const ctv = await findCtvById(session.ctvId);
  if (!ctv) return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });

  const { password_hash: _passwordHash, ...profile } = ctv;
  return NextResponse.json({ profile });
}

// CTV chỉ tự sửa được phần liên hệ hiển thị trên bảng giá — tên/SĐT/CCCD là
// thông tin định danh do admin quản lý, không cho tự đổi ở đây.
export async function PATCH(request: Request) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await request.json();
  const ok = await updateCtvUser(session.ctvId, {
    contactName: typeof body.contactName === "string" ? body.contactName.trim() || null : undefined,
    contactPhone: typeof body.contactPhone === "string" ? body.contactPhone.trim() || null : undefined,
    contactZaloHref: typeof body.contactZaloHref === "string" ? body.contactZaloHref.trim() || null : undefined,
  });
  return NextResponse.json({ ok });
}
