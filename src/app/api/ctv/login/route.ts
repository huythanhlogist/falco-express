import { NextResponse } from "next/server";
import { findCtvByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import {
  CTV_SESSION_COOKIE,
  CTV_SESSION_COOKIE_MAX_AGE,
  createCtvSessionToken,
} from "@/lib/ctv-auth";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Vui lòng nhập email và mật khẩu" },
      { status: 400 }
    );
  }

  const ctv = await findCtvByEmail(email);
  if (!ctv || !(await verifyPassword(password, ctv.password_hash))) {
    return NextResponse.json(
      { error: "Email hoặc mật khẩu không đúng" },
      { status: 401 }
    );
  }
  if (ctv.status !== "active") {
    return NextResponse.json(
      { error: "Tài khoản đã bị vô hiệu hoá, liên hệ Falco để được hỗ trợ" },
      { status: 403 }
    );
  }

  const token = await createCtvSessionToken(ctv.id, ctv.email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CTV_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CTV_SESSION_COOKIE_MAX_AGE,
  });
  return res;
}
