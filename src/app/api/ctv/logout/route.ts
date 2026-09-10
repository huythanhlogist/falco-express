import { NextResponse } from "next/server";
import { CTV_SESSION_COOKIE } from "@/lib/ctv-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CTV_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
