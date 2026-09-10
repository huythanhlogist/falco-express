import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { CTV_SESSION_COOKIE, verifyCtvSessionToken } from "@/lib/ctv-auth";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];
const PUBLIC_CTV_PATHS = ["/ctv/login", "/api/ctv/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Vùng CTV — cookie/secret RIÊNG với admin, kiểm tra tách biệt hoàn toàn
  // (xem ghi chú trong src/lib/ctv-auth.ts) để 1 phiên không thể dùng thay
  // cho phiên kia dù có đọc nhầm cookie.
  if (pathname.startsWith("/ctv") || pathname.startsWith("/api/ctv")) {
    if (PUBLIC_CTV_PATHS.some((p) => pathname === p)) {
      return NextResponse.next();
    }
    const token = request.cookies.get(CTV_SESSION_COOKIE)?.value;
    const session = token ? await verifyCtvSessionToken(token) : null;
    if (!session) {
      if (pathname.startsWith("/api/ctv")) {
        return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/ctv/login", request.url));
    }
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/ctv/:path*", "/api/ctv/:path*"],
};
