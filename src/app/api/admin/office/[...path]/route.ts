import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { fetchOfficeWithRetry } from "@/lib/n8n-office-fetch";

export const dynamic = "force-dynamic";

// Chuyển yêu cầu từ trang admin tới webhook n8n tương ứng. Chỉ cho phép các
// đường dẫn trong danh sách dưới đây; khóa n8n chỉ nằm ở biến môi trường server.
const GET_PATHS = new Set(["leads", "notes", "zalo", "knowledge", "outreach"]);
const POST_PATHS = new Set(["lead-action", "task-action", "run-sales", "note-action", "zalo-action", "zalo-send-now", "knowledge-action"]);

async function forward(
  request: Request,
  params: Promise<{ path: string[] }>,
  method: "GET" | "POST",
) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { path } = await params;
  const name = path.join("/");
  const allowed = method === "GET" ? GET_PATHS : POST_PATHS;
  if (!allowed.has(name)) {
    return NextResponse.json({ ok: false, error: "Không hỗ trợ" }, { status: 404 });
  }

  const key = process.env.N8N_OFFICE_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Chưa cấu hình N8N_OFFICE_KEY trên server" },
      { status: 503 },
    );
  }
  const base = (process.env.N8N_BASE_URL || "https://n8n.falcoexpress.com").trim();
  const search = method === "GET" ? new URL(request.url).search : "";

  const init: RequestInit = {
    method,
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  };
  if (method === "POST") {
    try {
      init.body = JSON.stringify(await request.json());
    } catch {
      return NextResponse.json({ ok: false, error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
    }
  }

  // GET thử lại và giữ bản gần nhất; POST chỉ gửi một lần để không làm trùng thao tác.
  if (method === "GET") {
    const r = await fetchOfficeWithRetry(`${base}/webhook/office/${name}${search}`, init, `${name}${search}`);
    if (r.status === 401 || r.status === 403) {
      return NextResponse.json(
        { ok: false, error: "Khóa N8N_OFFICE_KEY trên server không khớp với n8n (kiểm tra dán nhầm khóa hoặc thừa khoảng trắng)" },
        { status: 502 },
      );
    }
    return NextResponse.json(r.body, { status: r.status });
  }
  try {
    const res = await fetch(`${base}/webhook/office/${name}${search}`, init);
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { ok: false, error: "Khóa N8N_OFFICE_KEY trên server không khớp với n8n (kiểm tra dán nhầm khóa hoặc thừa khoảng trắng)" },
        { status: 502 },
      );
    }
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: res.ok, error: res.ok ? undefined : `n8n trả về ${res.status}` };
    }
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: "Không kết nối được n8n" }, { status: 502 });
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, ctx.params, "GET");
}

export async function POST(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(request, ctx.params, "POST");
}
