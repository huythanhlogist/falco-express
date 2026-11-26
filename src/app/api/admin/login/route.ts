import { NextResponse } from "next/server";
import { findAdminByEmail } from "@/lib/db";
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  getAdminSessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import {
  LOGIN_MAX_ATTEMPTS,
  checkLoginRateLimit,
  clearLoginRateLimit,
  makeLoginRateLimitKey,
  recordLoginFailure,
} from "@/lib/rate-limit";

function rateLimitResponse(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return NextResponse.json(
    {
      error: `Bạn đã nhập sai quá ${LOGIN_MAX_ATTEMPTS} lần. Vui lòng thử lại sau ${minutes} phút.`,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Vui lòng nhập email và mật khẩu" },
      { status: 400 }
    );
  }

  const rateKey = makeLoginRateLimitKey(request, email);
  const limit = checkLoginRateLimit(rateKey);
  if (!limit.allowed) {
    return rateLimitResponse(limit.retryAfterSeconds);
  }

  const admin = await findAdminByEmail(email);
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    const failed = recordLoginFailure(rateKey);
    if (failed.blocked) {
      return rateLimitResponse(failed.retryAfterSeconds);
    }
    return NextResponse.json(
      { error: "Email hoặc mật khẩu không đúng" },
      { status: 401 }
    );
  }

  clearLoginRateLimit(rateKey);

  const token = await createSessionToken(admin.email, admin.role);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, getAdminSessionCookieOptions());
  return res;
}
