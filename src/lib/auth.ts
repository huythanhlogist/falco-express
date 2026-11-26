import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { AdminRole } from "@/lib/db";

export const ADMIN_SESSION_COOKIE = "falco_admin_session";
// 30 ngày — nới dài hơn mức thường (7 ngày) vì app cài ở màn hình chính
// iOS đôi khi không giữ được phiên đăng nhập ổn định như 1 tab Safari
// thường, khiến nhân viên phải đăng nhập lại thường xuyên hơn dự tính.
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 ngày

function getSecretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("Thiếu biến môi trường ADMIN_SESSION_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function createSessionToken(
  email: string,
  role: AdminRole
): Promise<string> {
  return new SignJWT({ email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export type SessionPayload = { email: string; role: AdminRole };

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.email !== "string") return null;
    const role = payload.role === "owner" ? "owner" : "staff";
    return { email: payload.email, role };
  } catch {
    return null;
  }
}

/** Đọc session của request hiện tại trong Server Component / Route Handler. */
export async function getCurrentAdminSession(): Promise<SessionPayload | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  // Kiểm tra nhân viên còn tồn tại trong DB (cache 60 giây) để tài khoản bị xoá mất hiệu lực ngay.
  // Dùng dynamic import để proxy.ts (Edge) không kéo theo mysql2 khi chỉ gọi verifySessionToken.
  const { getActiveAdminRole } = await import("@/lib/admin-staff-check");
  const activeRole = await getActiveAdminRole(session.email);
  if (!activeRole) return null;

  return { email: session.email, role: activeRole };
}

export const SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;

/** Thuộc tính cookie dùng chung cho login và logout để xoá cookie khớp hoàn toàn lúc set. */
export function getAdminSessionCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
