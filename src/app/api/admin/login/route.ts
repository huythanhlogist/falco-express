import { NextResponse } from "next/server";
import { findAdminByEmail } from "@/lib/db";
import {
  ADMIN_SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Vui lòng nhập email và mật khẩu" },
      { status: 400 }
    );
  }

  const admin = await findAdminByEmail(email);
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    return NextResponse.json(
      { error: "Email hoặc mật khẩu không đúng" },
      { status: 401 }
    );
  }

  const token = await createSessionToken(admin.email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return res;
}
