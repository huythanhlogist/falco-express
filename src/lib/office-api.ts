// Gọi API proxy /api/admin/office/* (server chuyển tiếp tới webhook n8n).

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function officeApi<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/admin/office/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error ?? `Lỗi ${res.status}` };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Không kết nối được máy chủ" };
  }
}

export type LeadItem = {
  id: number;
  saleAgent: string;
  target: string;
  company: string;
  contact: string;
  sourceUrl: string;
  product: string;
  markets: string;
  score: number;
  reason: string;
  draft: string;
  status: string;
  qaVerdict: string;
  qaNote: string;
  createdAt: string;
};

export type LeadsResponse = {
  status: string;
  counts: { cho_duyet: number; da_duyet: number; loai: number };
  leads: LeadItem[];
};

export type NoteItem = {
  id: number;
  kind: "loi" | "ghi_chu" | "yeu_cau";
  text: string;
  taskCode: string;
  leadId: number | null;
  assignee: "muse" | "claude" | "huy";
  status: "mo" | "dang_xu_ly" | "da_xong";
  resolution: string;
  linkedTask: string;
  createdAt: string;
};

export type AutoError = {
  taskCode: string;
  type: string;
  status: string;
  bot: string;
  reason: string;
  objective: string;
  updatedAt: string;
};

export type NotesResponse = {
  counts: { mo: number; dang_xu_ly: number; da_xong: number };
  notes: NoteItem[];
  autoErrors: AutoError[];
};

export const KIND_LABEL: Record<NoteItem["kind"], string> = {
  loi: "Lỗi",
  ghi_chu: "Ghi chú",
  yeu_cau: "Yêu cầu",
};

export const ASSIGNEE_LABEL: Record<NoteItem["assignee"], string> = {
  muse: "Muse",
  claude: "Claude",
  huy: "Tôi",
};

export const NOTE_STATUS_LABEL: Record<NoteItem["status"], string> = {
  mo: "Mở",
  dang_xu_ly: "Đang xử lý",
  da_xong: "Đã xong",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  cho_giao: "Chờ giao",
  dang_lam: "Đang làm",
  cho_nap: "Chờ nạp",
  done: "Xong",
  blocked: "Bị chặn",
  failed: "Lỗi",
  huy: "Đã hủy",
};

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

// Số di động Việt Nam đầu tiên tìm thấy trong ô liên hệ (Zalo cần số điện thoại). Khớp luật của n8n.
export function phoneOf(contact: string): string {
  const re = /(?:\+?84|0)[\s.()\-]*(?:\d[\s.()\-]*){8,10}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contact || "")) !== null) {
    let d = m[0].replace(/\D/g, "");
    if (d.startsWith("84")) d = "0" + d.slice(2);
    if (/^0(3|5|7|8|9)\d{8}$/.test(d)) return d;
  }
  return "";
}

export type ZaloResponse = {
  enabled: boolean;
  bridge: {
    loggedIn: boolean;
    account: string;
    sentToday: number;
    dailyLimit: number;
    canSendNow: boolean;
    reason: string;
  } | null;
  counts: { ready: number; noPhone: number; duplicate: number; sent: number; replied: number; failed: number };
  approved: {
    id: number;
    company: string;
    contact: string;
    phone: string;
    score: number;
    saleAgent: string;
    draft: string;
    hasPhone: boolean;
    duplicate: boolean;
  }[];
  sent: {
    id: number;
    company: string;
    phone: string;
    status: "da_gui" | "da_phan_hoi" | "gui_loi";
    sentAt: string | null;
    note: string;
    replyText: string;
    repliedAt: string | null;
    draft: string;
    saleAgent: string;
  }[];
};

export type KnowledgeItem = {
  id: number;
  area: string;
  kind: string;
  title: string;
  content: string;
  sourceUrl: string;
  status: "de_xuat" | "da_duyet" | "loai";
  addedBy: string;
  note: string;
  createdAt: string;
};

export type KnowledgeResponse = {
  agents: { code: string; name: string; role: string }[];
  counts: { de_xuat: number; da_duyet: number; loai: number };
  items: KnowledgeItem[];
};

export const KNOWLEDGE_KIND_LABEL: Record<string, string> = {
  tieu_chi_lead: "Tiêu chí lead",
  khach_mau: "Khách mẫu",
  kenh_tim: "Kênh tìm",
  tu_khoa: "Từ khóa",
  cau_mau: "Câu mẫu",
  tu_cam: "Từ cấm",
  faq: "Hỏi đáp",
  doi_thu: "Đối thủ",
  bai_hoc: "Bài học",
  khac: "Khác",
};
