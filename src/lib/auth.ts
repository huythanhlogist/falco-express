import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

export const ADMIN_SESSION_COOKIE = "falco_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 ngày

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

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export type SessionPayload = { email: string };

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.email !== "string") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
