import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { BayApiError, bayRequest, isBayConfigured } from "@/lib/bay-api";

// Proxy chỉ-admin tới BayOnline Partner API. Chỉ cho đi qua đúng các endpoint
// đã biết (whitelist), API key giữ ở server và không bao giờ trả về trình duyệt.
const GET_ROUTES = [
  /^me$/,
  /^warehouses$/,
  /^shipments$/,
  /^shipments\/[^/]+$/,
  /^shipments\/[^/]+\/tracking$/,
];
const POST_ROUTES = [/^draft-orders$/, /^draft-orders\/[^/]+\/confirm$/];

// Chặn mọi segment rỗng, ".", "..", ký tự điều khiển, dấu "/", "\", "?", "#", "%" (mã hoá URL).
const SAFE_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;
const ENCODED_TRAVERSAL_RE = /%(?:2e|2f|5c|00)/i;

function validateBayPath(request: Request, path: string[]): string | null {
  if (!Array.isArray(path) || path.length === 0) return null;

  // Kiểm tra raw pathname để chặn các chuỗi mã hoá traversal (%2e, %2f, %5c) trước khi Next decode.
  const rawPathname = new URL(request.url).pathname;
  if (ENCODED_TRAVERSAL_RE.test(rawPathname) || rawPathname.includes("..") || rawPathname.includes("\\")) {
    return null;
  }

  for (const seg of path) {
    if (
      !seg ||
      seg === "." ||
      seg === ".." ||
      seg.includes("..") ||
      seg.includes("%") ||
      !SAFE_SEGMENT_RE.test(seg)
    ) {
      return null;
    }
  }

  return path.join("/");
}

function encodeBayPath(path: string[]): string {
  return path.map((seg) => encodeURIComponent(seg)).join("/");
}

function errorResponse(err: unknown) {
  if (err instanceof BayApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code, requestId: err.requestId, details: err.details },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
    );
  }
  return NextResponse.json({ error: "Lỗi không xác định khi gọi BayOnline" }, { status: 500 });
}

async function guard(request: Request, path: string[], routes: RegExp[]) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!isBayConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình BAY_API_KEY", code: "not_configured" }, { status: 503 });
  }
  const joined = validateBayPath(request, path);
  if (!joined || !routes.some((re) => re.test(joined))) {
    return NextResponse.json({ error: "Endpoint không được hỗ trợ" }, { status: 404 });
  }
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const blocked = await guard(request, path, GET_ROUTES);
  if (blocked) return blocked;

  const query = Object.fromEntries(new URL(request.url).searchParams);
  try {
    return NextResponse.json(await bayRequest("GET", `/api/v1/${encodeBayPath(path)}`, { query }));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const blocked = await guard(request, path, POST_ROUTES);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body JSON không hợp lệ" }, { status: 400 });
  }
  try {
    const data = await bayRequest("POST", `/api/v1/${encodeBayPath(path)}`, {
      body,
      idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
