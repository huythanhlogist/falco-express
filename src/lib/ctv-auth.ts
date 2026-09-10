import { SignJWT, jwtVerify } from "jose";

export const CTV_SESSION_COOKIE = "falco_ctv_session";
// Cookie TÊN RIÊNG + secret ký RIÊNG (CTV_SESSION_SECRET, khác
// ADMIN_SESSION_SECRET) so với phiên admin — 2 vùng quyền không được lẫn
// vào nhau: 1 cookie admin không được coi là hợp lệ ở /ctv/* và ngược lại,
// kể cả khi vô tình cùng đọc được cookie của nhau.
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 ngày, giống phiên admin

function getSecretKey(): Uint8Array {
  const secret = process.env.CTV_SESSION_SECRET;
  if (!secret) {
    throw new Error("Thiếu biến môi trường CTV_SESSION_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export type CtvSessionPayload = { ctvId: number; email: string };

export async function createCtvSessionToken(
  ctvId: number,
  email: string
): Promise<string> {
  return new SignJWT({ ctvId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyCtvSessionToken(
  token: string
): Promise<CtvSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.email !== "string" || typeof payload.ctvId !== "number") return null;
    return { ctvId: payload.ctvId, email: payload.email };
  } catch {
    return null;
  }
}

/** Đọc session CTV của request hiện tại trong Server Component / Route Handler. */
export async function getCurrentCtvSession(): Promise<CtvSessionPayload | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(CTV_SESSION_COOKIE)?.value;
  return token ? verifyCtvSessionToken(token) : null;
}

export const CTV_SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS;
