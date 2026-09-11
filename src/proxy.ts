import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { CTV_SESSION_COOKIE, verifyCtvSessionToken } from "@/lib/ctv-auth";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];
const PUBLIC_CTV_PATHS = ["/ctv/login", "/api/ctv/login"];

/**
 * Cho phép 1 agent ngoài (không có phiên đăng nhập admin) dùng 1 key riêng
 * (AGENT_API_KEY, khác hẳn mật khẩu admin) cho 1 tập route CỐ ĐỊNH, giới
 * hạn đúng những gì agent cần để: (1) tạo BILL NHÁP, (2) đọc hàng chờ
 * "AI nhập đơn" (note + ảnh nhân viên upload) để chính agent xử lý, (3)
 * đánh dấu 1 đơn trong hàng chờ đó là đã xử lý. Agent KHÔNG có ngoại lệ để
 * xoá đơn (DELETE vẫn chỉ session admin mới gọi được) và KHÔNG có ngoại lệ
 * cho route gửi thật lên Kango (.../send) — agent chỉ tạo được nháp/đọc dữ
 * liệu, người duyệt vẫn phải tự vào web bấm "Duyệt & Gửi Kango" như đã chốt.
 */
const AGENT_ALLOWED_ROUTES: { method: string; pattern: RegExp }[] = [
  { method: "POST", pattern: /^\/api\/admin\/kango-bills$/ },
  { method: "GET", pattern: /^\/api\/admin\/ai-intake$/ },
  { method: "GET", pattern: /^\/api\/admin\/ai-intake\/\d+\/images$/ },
  { method: "GET", pattern: /^\/api\/admin\/ai-intake\/image\/\d+$/ },
  { method: "PATCH", pattern: /^\/api\/admin\/ai-intake\/\d+$/ },
];

function isAgentApiRequest(request: NextRequest): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  if (!key || !expected || key !== expected) return false;
  return AGENT_ALLOWED_ROUTES.some(
    (r) => r.method === request.method && r.pattern.test(request.nextUrl.pathname)
  );
}

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

  if (isAgentApiRequest(request)) {
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
