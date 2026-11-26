import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { fetchOfficeWithRetry } from "@/lib/n8n-office-fetch";
import { OFFICE_BOTS, OFFICE_RULES, OFFICE_SALE_IDS } from "@/lib/office-agents";
import { KNOWLEDGE_KIND_LABEL, type KnowledgeResponse } from "@/lib/office-api";

export const dynamic = "force-dynamic";

// Chuyển yêu cầu từ trang admin tới webhook n8n tương ứng. Chỉ cho phép các
// đường dẫn trong danh sách dưới đây; khóa n8n chỉ nằm ở biến môi trường server.
const GET_PATHS = new Set(["status", "leads", "notes", "zalo", "knowledge", "outreach", "kpi"]);
const POST_PATHS = new Set([
  "lead-action",
  "task-action",
  "run-sales",
  "note-action",
  "zalo-action",
  "zalo-send-now",
  "knowledge-action",
]);

const KEY_MISMATCH_ERROR =
  "Khóa N8N_OFFICE_KEY trên server không khớp với n8n (kiểm tra dán nhầm khóa hoặc thừa khoảng trắng)";

const LEAD_FILTERS = new Set(["giu_tay", "cho_duyet", "da_duyet", "da_gui", "loai"]);
const LEAD_ACTIONS = new Set(["approve", "reject", "undo", "edit", "quote", "won", "dealreset"]);
const OWNER_ONLY_LEAD_ACTIONS = new Set(["won", "dealreset"]);
const SALE_ID_SET = new Set<string>(OFFICE_SALE_IDS);
const BOT_ID_SET = new Set<string>(OFFICE_BOTS.map((b) => b.id));
const BOT_OR_ANY_SET = new Set<string>(["any", ...OFFICE_BOTS.map((b) => b.id)]);
const NOTE_KINDS = new Set(["loi", "ghi_chu", "yeu_cau"]);
const NOTE_ASSIGNEES = new Set(["muse", "claude", "huy"]);
const NOTE_STATUSES = new Set(["mo", "dang_xu_ly", "da_xong"]);
const KNOWLEDGE_KINDS = new Set(Object.keys(KNOWLEDGE_KIND_LABEL));
const KNOWLEDGE_STATUSES = new Set(["de_xuat", "da_duyet", "loai"]);

type ValidationResult =
  | { ok: true; payload: Record<string, unknown>; ownerOnly?: boolean; checkExistingChanDungId?: number }
  | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asPositiveInt(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

function asTrimmedString(v: unknown, minLen: number, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length < minLen || s.length > maxLen) return null;
  return s;
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Chỉ giữ query param hợp lệ cho từng endpoint GET để tránh phình cacheKey. */
function buildCleanSearch(name: string, urlStr: string): string {
  const url = new URL(urlStr);
  const out = new URLSearchParams();
  if (name === "leads") {
    const status = url.searchParams.get("status");
    if (status && LEAD_FILTERS.has(status)) {
      out.set("status", status);
    }
  } else if (name === "knowledge") {
    if (url.searchParams.get("summary") === "1") {
      out.set("summary", "1");
    }
  }
  const qs = out.toString();
  return qs ? `?${qs}` : "";
}

function validatePostPayload(name: string, raw: unknown): ValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Dữ liệu gửi lên không hợp lệ" };
  }

  if (name === "zalo-send-now") {
    const id = asPositiveInt(raw.id);
    if (!id) return { ok: false, error: "Mã lead không hợp lệ" };
    return { ok: true, payload: { id }, ownerOnly: true };
  }

  if (name === "zalo-action") {
    const action = raw.action;
    if (action === "set_enabled") {
      if (typeof raw.enabled !== "boolean") {
        return { ok: false, error: "Trạng thái bật/tắt không hợp lệ" };
      }
      return { ok: true, payload: { action, enabled: raw.enabled }, ownerOnly: true };
    }
    if (action === "retry") {
      const id = asPositiveInt(raw.id);
      if (!id) return { ok: false, error: "Mã tin cần gửi lại không hợp lệ" };
      return { ok: true, payload: { action, id }, ownerOnly: true };
    }
    return { ok: false, error: "Thao tác Zalo không hợp lệ" };
  }

  if (name === "lead-action") {
    const action = typeof raw.action === "string" ? raw.action : "";
    if (!LEAD_ACTIONS.has(action)) {
      return { ok: false, error: "Thao tác lead không hợp lệ" };
    }
    const id = asPositiveInt(raw.id);
    if (!id) return { ok: false, error: "Mã lead không hợp lệ" };

    const payload: Record<string, unknown> = { id, action };

    if (action === "edit") {
      const draft = asTrimmedString(raw.draft, 1, 2000);
      if (!draft) return { ok: false, error: "Tin nháp không được để trống (tối đa 2000 ký tự)" };
      if (wordCount(draft) > OFFICE_RULES.maxDraftWords) {
        return { ok: false, error: `Tin nháp vượt quá ${OFFICE_RULES.maxDraftWords} từ` };
      }
      payload.draft = draft;
    } else if (action === "reject") {
      if (raw.note !== undefined) {
        if (typeof raw.note !== "string" || raw.note.length > 500) {
          return { ok: false, error: "Lý do loại không hợp lệ (tối đa 500 ký tự)" };
        }
        payload.note = raw.note.trim();
      }
    } else if (action === "won") {
      if (raw.value !== undefined) {
        if (
          typeof raw.value !== "number" ||
          !Number.isFinite(raw.value) ||
          raw.value < 0 ||
          raw.value > 100_000_000_000
        ) {
          return { ok: false, error: "Giá trị đơn chốt không hợp lệ" };
        }
        payload.value = Math.round(raw.value);
      }
    }

    return { ok: true, payload, ownerOnly: OWNER_ONLY_LEAD_ACTIONS.has(action) };
  }

  if (name === "run-sales") {
    if (!Array.isArray(raw.agents) || raw.agents.length === 0 || raw.agents.length > OFFICE_SALE_IDS.length) {
      return { ok: false, error: "Danh sách sale cần chạy không hợp lệ" };
    }
    const unique: string[] = [];
    for (const a of raw.agents) {
      if (typeof a !== "string" || !SALE_ID_SET.has(a)) {
        return { ok: false, error: "Mã sale không hợp lệ" };
      }
      if (!unique.includes(a)) unique.push(a);
    }
    return { ok: true, payload: { agents: unique } };
  }

  if (name === "task-action") {
    const action = raw.action;
    if (action === "create") {
      const bot = typeof raw.bot === "string" ? raw.bot : "";
      if (!BOT_OR_ANY_SET.has(bot)) return { ok: false, error: "Bot giao việc không hợp lệ" };
      const objective = asTrimmedString(raw.objective, 5, 300);
      if (!objective) return { ok: false, error: "Mục tiêu phải từ 5 đến 300 ký tự" };
      const instructions =
        raw.instructions === undefined
          ? ""
          : typeof raw.instructions === "string" && raw.instructions.length <= 4000
            ? raw.instructions.trim()
            : null;
      if (instructions === null) return { ok: false, error: "Chi tiết việc tối đa 4000 ký tự" };
      return { ok: true, payload: { action, bot, objective, instructions } };
    }
    if (action === "ping") {
      const bot = typeof raw.bot === "string" ? raw.bot : "";
      if (!BOT_ID_SET.has(bot)) return { ok: false, error: "Mã bot cần ping không hợp lệ" };
      return { ok: true, payload: { action, bot } };
    }
    if (action === "cancel" || action === "requeue") {
      const taskCode = asTrimmedString(raw.task_code, 1, 100);
      if (!taskCode) return { ok: false, error: "Mã việc không hợp lệ" };
      return { ok: true, payload: { action, task_code: taskCode } };
    }
    return { ok: false, error: "Thao tác hàng đợi không hợp lệ" };
  }

  if (name === "note-action") {
    const action = raw.action;
    if (action === "add") {
      const kind = typeof raw.kind === "string" ? raw.kind : "";
      if (!NOTE_KINDS.has(kind)) return { ok: false, error: "Loại ghi chú không hợp lệ" };
      const text = asTrimmedString(raw.text, 3, 2000);
      if (!text) return { ok: false, error: "Nội dung ghi chú phải từ 3 đến 2000 ký tự" };
      const assignee = typeof raw.assignee === "string" ? raw.assignee : "";
      if (!NOTE_ASSIGNEES.has(assignee)) return { ok: false, error: "Người xử lý không hợp lệ" };

      const payload: Record<string, unknown> = { action, kind, text, assignee };
      if (raw.task_code !== undefined && raw.task_code !== "") {
        const taskCode = asTrimmedString(raw.task_code, 1, 100);
        if (!taskCode) return { ok: false, error: "Mã việc liên quan tối đa 100 ký tự" };
        payload.task_code = taskCode;
      } else if (raw.task_code === "") {
        payload.task_code = "";
      }
      if (raw.lead_id !== undefined && raw.lead_id !== null) {
        const leadId = asPositiveInt(raw.lead_id);
        if (!leadId) return { ok: false, error: "Mã lead liên quan không hợp lệ" };
        payload.lead_id = leadId;
      }
      return { ok: true, payload };
    }
    if (action === "assign") {
      const id = asPositiveInt(raw.id);
      if (!id) return { ok: false, error: "Mã ghi chú không hợp lệ" };
      const assignee = typeof raw.assignee === "string" ? raw.assignee : "";
      if (!NOTE_ASSIGNEES.has(assignee)) return { ok: false, error: "Người xử lý không hợp lệ" };
      return { ok: true, payload: { action, id, assignee } };
    }
    if (action === "send_to_muse") {
      const id = asPositiveInt(raw.id);
      if (!id) return { ok: false, error: "Mã ghi chú không hợp lệ" };
      const bot = typeof raw.bot === "string" ? raw.bot : "";
      if (!BOT_OR_ANY_SET.has(bot)) return { ok: false, error: "Bot Muse không hợp lệ" };
      return { ok: true, payload: { action, id, bot } };
    }
    if (action === "set_status") {
      const id = asPositiveInt(raw.id);
      if (!id) return { ok: false, error: "Mã ghi chú không hợp lệ" };
      const status = typeof raw.status === "string" ? raw.status : "";
      if (!NOTE_STATUSES.has(status)) return { ok: false, error: "Trạng thái ghi chú không hợp lệ" };
      const payload: Record<string, unknown> = { action, id, status };
      if (raw.resolution !== undefined) {
        if (typeof raw.resolution !== "string" || raw.resolution.length > 2000) {
          return { ok: false, error: "Nội dung cách xử lý tối đa 2000 ký tự" };
        }
        payload.resolution = raw.resolution.trim();
      }
      return { ok: true, payload };
    }
    return { ok: false, error: "Thao tác ghi chú không hợp lệ" };
  }

  if (name === "knowledge-action") {
    const action = raw.action;
    if (action === "add" || action === "edit") {
      const area = asTrimmedString(raw.area, 1, 40);
      if (!area) return { ok: false, error: "Vui lòng chọn agent/phạm vi kiến thức" };
      const kind = typeof raw.kind === "string" ? raw.kind : "";
      if (!KNOWLEDGE_KINDS.has(kind)) return { ok: false, error: "Loại kiến thức không hợp lệ" };
      const title = asTrimmedString(raw.title, 1, 120);
      if (!title) return { ok: false, error: "Tiêu đề không được để trống (tối đa 120 ký tự)" };
      const content = asTrimmedString(raw.content, 1, 1500);
      if (!content) return { ok: false, error: "Nội dung không được để trống (tối đa 1500 ký tự)" };

      if (action === "edit") {
        const id = asPositiveInt(raw.id);
        if (!id) return { ok: false, error: "Mã mục kiến thức không hợp lệ" };
        return {
          ok: true,
          payload: { action, id, area, kind, title, content },
          ownerOnly: kind === "chan_dung",
          checkExistingChanDungId: id,
        };
      }
      return {
        ok: true,
        payload: { action, area, kind, title, content },
        ownerOnly: kind === "chan_dung",
      };
    }
    if (action === "set_status") {
      const id = asPositiveInt(raw.id);
      if (!id) return { ok: false, error: "Mã mục kiến thức không hợp lệ" };
      const status = typeof raw.status === "string" ? raw.status : "";
      if (!KNOWLEDGE_STATUSES.has(status)) {
        return { ok: false, error: "Trạng thái kiến thức không hợp lệ" };
      }
      const isChanDungHint = raw.kind === "chan_dung";
      return {
        ok: true,
        payload: { action, id, status },
        ownerOnly: isChanDungHint,
        checkExistingChanDungId: id,
      };
    }
    return { ok: false, error: "Thao tác kiến thức không hợp lệ" };
  }

  return { ok: false, error: "Không hỗ trợ" };
}

/** Kiểm tra mục kiến thức hiện tại có phải loại chan_dung không (chặn staff sửa/đổi trạng thái gián tiếp). */
async function isExistingChanDung(
  base: string,
  key: string,
  itemId: number,
): Promise<{ checked: true; isChanDung: boolean } | { checked: false }> {
  const res = await fetchOfficeWithRetry(
    `${base}/webhook/office/knowledge`,
    { headers: { "x-api-key": key }, cache: "no-store" },
    "knowledge",
  );
  if (res.status < 200 || res.status >= 300 || !res.body || typeof res.body !== "object") {
    return { checked: false };
  }
  const items = (res.body as Partial<KnowledgeResponse>).items;
  if (!Array.isArray(items)) return { checked: false };
  const target = items.find((i) => i.id === itemId);
  return { checked: true, isChanDung: target?.kind === "chan_dung" };
}

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

  // GET thử lại và giữ bản gần nhất; POST chỉ gửi một lần để không làm trùng thao tác.
  if (method === "GET") {
    const cleanSearch = buildCleanSearch(name, request.url);
    const r = await fetchOfficeWithRetry(
      `${base}/webhook/office/${name}${cleanSearch}`,
      {
        method: "GET",
        headers: { "x-api-key": key },
        cache: "no-store",
      },
      `${name}${cleanSearch}`,
    );
    if (r.status === 401 || r.status === 403) {
      return NextResponse.json({ ok: false, error: KEY_MISMATCH_ERROR }, { status: 502 });
    }
    return NextResponse.json(r.body, { status: r.status });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
  }

  const validated = validatePostPayload(name, rawBody);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  if (validated.ownerOnly && session.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "Chỉ chủ tài khoản mới được thực hiện thao tác này" },
      { status: 403 },
    );
  }

  if (validated.checkExistingChanDungId && session.role !== "owner") {
    const check = await isExistingChanDung(base, key, validated.checkExistingChanDungId);
    if (!check.checked) {
      return NextResponse.json(
        { ok: false, error: "Không kiểm tra được quyền chỉnh sửa mục kiến thức này, vui lòng thử lại" },
        { status: 502 },
      );
    }
    if (check.isChanDung) {
      return NextResponse.json(
        { ok: false, error: "Chỉ chủ tài khoản mới được sửa hoặc đổi trạng thái Chân dung khách" },
        { status: 403 },
      );
    }
  }

  try {
    const res = await fetch(`${base}/webhook/office/${name}`, {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify(validated.payload),
    });
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ ok: false, error: KEY_MISMATCH_ERROR }, { status: 502 });
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
