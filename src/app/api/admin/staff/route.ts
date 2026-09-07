import { NextResponse } from "next/server";
import { getCurrentAdminSession, hashPassword } from "@/lib/auth";
import { insertAdminUser, listAdminUsers, findAdminByEmail } from "@/lib/db";

export async function GET() {
  const staff = await listAdminUsers();
  return NextResponse.json({ staff });
}

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (session?.role !== "owner") {
    return NextResponse.json(
      { error: "Chỉ chủ tài khoản mới có thể tạo tài khoản nhân viên" },
      { status: 403 }
    );
  }

  const { email, password } = await request.json();
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Mật khẩu phải có ít nhất 8 ký tự" },
      { status: 400 }
    );
  }

  const existing = await findAdminByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "Email này đã có tài khoản" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const id = await insertAdminUser(email, passwordHash, "staff");

  return NextResponse.json({ ok: true, id });
}
