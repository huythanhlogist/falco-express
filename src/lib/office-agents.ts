// Danh sách "nhân viên ảo" và cấu hình dùng chung của văn phòng AI Falco (/admin/van-phong).
// Mọi luật vận hành, danh sách sale và bot Muse đều gom về file này để tránh lệch giữa các tab.
// Trạng thái thật đọc từ n8n qua /api/admin/office/status (hàng đợi việc của
// Muse + heartbeat + bảng lead). Chế độ mô phỏng chỉ để xem thử giao diện.

export type AgentStatus = "idle" | "working" | "review" | "offline";

/** Luật & mục tiêu vận hành thống nhất cho toàn bộ Văn phòng AI (ưu tiên giá trị từ n8n nếu có). */
export const OFFICE_RULES = {
  autoApproveScore: 70, // ngưỡng điểm tự duyệt (có SĐT Zalo)
  manualSendScore: 85, // ngưỡng điểm giữ lại gửi tay
  zaloDailyLimit: 30, // hạn mức tin/ngày mặc định nếu bridge/n8n chưa trả
  zaloMinIntervalMinutes: 3, // khoảng cách tối thiểu giữa 2 tin Zalo
  zaloSendDays: "T2 đến T7",
  zaloSendHours: "8h đến 19h",
  autoSearchSchedule: "20:30",
  maxLeadsPerRun: 5,
  maxDraftWords: 150,
  kpiTargetSentPerDay: 30,
  kpiTargetPassedPerSale: 6,
  kpiTargetReplyRate: 20,
  kpiTargetWinRate: 5,
} as const;

export type OfficeSaleConfig = {
  id: "linh" | "nam" | "vy" | "mai" | "khoa";
  code: string;
  name: string;
  shortLabel: string;
  queueLabel: string;
  kpiNote: string;
  role: string;
  deskX: number;
  deskZ: number;
};

/** Danh sách 5 sale chuẩn dùng chung ở Tổng quan, Lead, Giao việc và KPI. */
export const OFFICE_SALES: readonly OfficeSaleConfig[] = [
  {
    id: "linh",
    code: "SALE-01",
    name: "Linh",
    shortLabel: "Linh · đặc sản Âu",
    queueLabel: "Linh: đặc sản châu Âu",
    kpiNote: "Shop đặc sản châu Âu & Anh",
    role: "SALE-01: shop và cơ sở nhỏ bán đặc sản VN (EU, Anh), do Muse thực hiện",
    deskX: -3,
    deskZ: -4.5,
  },
  {
    id: "nam",
    code: "SALE-02",
    name: "Nam",
    shortLabel: "Nam · shop Việt kiều",
    queueLabel: "Nam: shop bán Việt kiều (Âu, Úc)",
    kpiNote: "Shop online Việt kiều (Âu, Úc)",
    role: "SALE-02: shop online nhỏ bán cho Việt kiều (châu Âu, Úc), do Muse thực hiện",
    deskX: -0.4,
    deskZ: -4.5,
  },
  {
    id: "vy",
    code: "SALE-03",
    name: "Vy",
    shortLabel: "Vy · đại lý, CTV",
    queueLabel: "Vy: đại lý & CTV",
    kpiNote: "Đại lý & cộng tác viên (Âu, Úc)",
    role: "SALE-03: đại lý và cộng tác viên (châu Âu, Úc), do Muse thực hiện",
    deskX: 2.2,
    deskZ: -4.5,
  },
  {
    id: "mai",
    code: "SALE-04",
    name: "Mai",
    shortLabel: "Mai · khách & tiệm Việt ở Âu",
    queueLabel: "Mai: khách lẻ & tiệm người Việt ở châu Âu",
    kpiNote: "Khách lẻ & tiệm người Việt ở châu Âu",
    role: "SALE-04: khách lẻ và tiệm/shop người Việt ở châu Âu cần nhận hàng từ Việt Nam, do Muse thực hiện",
    deskX: 4.8,
    deskZ: -4.5,
  },
  {
    id: "khoa",
    code: "SALE-05",
    name: "Khoa",
    shortLabel: "Khoa · linh kiện Mỹ",
    queueLabel: "Khoa: linh kiện đi Mỹ",
    kpiNote: "Linh kiện điện tử đi Mỹ",
    role: "SALE-05: linh kiện điện tử, module, bo mạch gửi đi Mỹ (chỉ tuyến Mỹ), do Muse thực hiện",
    deskX: 7.4,
    deskZ: -4.5,
  },
];

export const OFFICE_SALE_IDS: readonly OfficeSaleConfig["id"][] = OFFICE_SALES.map((s) => s.id);

export const OFFICE_SALE_NOTE_BY_NAME: Record<string, string> = Object.fromEntries(
  OFFICE_SALES.map((s) => [s.name, s.kpiNote]),
);

export const OFFICE_BOTS = [
  { id: "musehuythanh", label: "Muse Huy Thanh" },
  { id: "videomuse", label: "Muse Video" },
] as const;

export const OFFICE_BOT_OPTIONS = [
  { id: "any", label: "Bot nào rảnh trước" },
  ...OFFICE_BOTS,
] as const;

export function museBotLabel(bot: string): string {
  return OFFICE_BOTS.find((b) => b.id === bot)?.label ?? bot;
}

export type OfficeDepartment = {
  id: string;
  label: string;
  color: number;
  // Tâm phòng và kích thước trên mặt phẳng (đơn vị khung cảnh 3D).
  x: number;
  z: number;
  w: number;
  d: number;
};

export type OfficeAgent = {
  id: string;
  name: string;
  role: string;
  deptId: string;
  kind: "ai" | "human";
  n8nId?: string;
  // Tên bot Muse trong hàng đợi n8n (musehuythanh | videomuse).
  museBot?: string;
  // Vị trí bàn làm việc.
  deskX: number;
  deskZ: number;
};

export const N8N_PROJECT_URL =
  "https://n8n.falcoexpress.com/projects/3hrO7ITzOoXKanK8/agents";

export const OFFICE_DEPARTMENTS: OfficeDepartment[] = [
  { id: "exec", label: "Ban giám đốc", color: 0x7a5cc7, x: -7.5, z: -3.5, w: 7, d: 6 },
  { id: "sale", label: "Phòng sale", color: 0x1f9d8a, x: 2.5, z: -3.5, w: 13, d: 6 },
  { id: "qa", label: "Kiểm soát chất lượng", color: 0xd6497a, x: -7.5, z: 3.5, w: 7, d: 6 },
  { id: "muse", label: "Muse: tìm lead & nội dung", color: 0xe08a1e, x: -1, z: 3.5, w: 6, d: 6 },
  { id: "pending", label: "Sắp mở: Chứng từ · Vận hành · Kế toán", color: 0x9aa7b8, x: 5.75, z: 3.5, w: 6.5, d: 6 },
];

export const OFFICE_AGENTS: OfficeAgent[] = [
  { id: "huy", name: "Anh Huy", role: "Chủ doanh nghiệp, duyệt cuối trước khi gửi", deptId: "exec", kind: "human", deskX: -10, deskZ: -4.5 },
  { id: "huybot", name: "Huy-bot", role: "Quản lý: n8n giao việc mỗi 10 phút cho Muse, tổng hợp kết quả", deptId: "exec", kind: "ai", deskX: -7.5, deskZ: -4.5 },
  { id: "advisor", name: "Cố vấn", role: "ADVISOR-01: khi sale tìm không ra lead thì nghĩ cách tìm mới, ghi vào kho kiến thức để sale thử", deptId: "exec", kind: "ai", deskX: -5, deskZ: -4.5 },
  ...OFFICE_SALES.map<OfficeAgent>((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    deptId: "sale",
    kind: "ai",
    deskX: s.deskX,
    deskZ: s.deskZ,
  })),
  { id: "quan", name: "Quân", role: "QA tự động: n8n kiểm tra lead bằng luật (giá, độ dài tin, trùng, bằng chứng)", deptId: "qa", kind: "ai", deskX: -7.5, deskZ: 2.5 },
  { id: "muse1", name: "Muse Huy Thanh", role: "Bot Muse 1 (@musehuythanh_bot): nhận việc từ hàng đợi n8n", deptId: "muse", kind: "ai", museBot: "musehuythanh", deskX: -2.5, deskZ: 2.5 },
  { id: "muse2", name: "Muse Video", role: "Bot Muse 2 (@videomuse_bot): nhận việc từ hàng đợi n8n", deptId: "muse", kind: "ai", museBot: "videomuse", deskX: 0.5, deskZ: 2.5 },
];

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Rảnh",
  working: "Đang làm việc",
  review: "Đang kiểm tra",
  offline: "Mất kết nối",
};

export const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "#94a3b8",
  working: "#16a34a",
  review: "#f59e0b",
  offline: "#dc2626",
};

// Việc đang làm hiển thị theo trạng thái (chế độ mô phỏng).
export function taskText(agent: OfficeAgent, status: AgentStatus): string {
  if (status === "offline") return "Không có nhịp sống từ bot";
  if (status === "idle") return "Chưa có việc";
  if (agent.id === "quan") return "Kiểm tra lead đang chờ QA";
  if (agent.id === "huybot") return "Tổng hợp báo cáo gửi anh Huy";
  if (agent.id === "huy") return "Duyệt danh sách lead và tin nháp";
  if (agent.id === "advisor") return "Đề xuất kênh và từ khóa tìm lead mới";
  if (agent.museBot) return "Đang thực thi việc từ hàng đợi n8n";
  return "Tìm và chấm điểm lead theo target";
}

// ---- Dữ liệu thật từ n8n (webhook office/status) ----

export type OfficeLive = {
  ok: boolean;
  generatedAt: string;
  stale?: boolean;
  staleSince?: string;
  muse: {
    bot: string;
    lastSeen: string | null;
    online: boolean;
    stale: boolean;
    taskCode: string;
    working?: number;
    threads?: { bot: string; online: boolean; taskCode: string }[];
  }[];
  sales: Record<
    string,
    { status: "working" | "queued" | "idle"; task: string; taskCode: string; bot: string }
  >;
  advisor?: { status: "working" | "queued" | "idle"; task: string; taskCode: string; bot: string };
  qa: { status: "review" | "idle" };
  manager: { status: "working" | "idle" };
  queue: {
    cho_giao: number;
    dang_lam: number;
    cho_nap: number;
    done: number;
    blocked: number;
    failed: number;
  };
  leads: { cho_duyet: number; loai: number; total: number };
  pending: {
    id: number;
    saleAgent: string;
    company: string;
    contact: string;
    sourceUrl: string;
    score: number;
    reason: string;
    draft: string;
  }[];
  recent: {
    taskCode: string;
    type: string;
    status: string;
    bot: string;
    summary: string;
    found: number;
    passed: number;
    updatedAt: string;
  }[];
  alerts: string[];
};

export function allIdleStatuses(): Record<string, AgentStatus> {
  return Object.fromEntries(
    OFFICE_AGENTS.map((a) => [a.id, "idle" as AgentStatus]),
  );
}

export function liveStatuses(live: OfficeLive): Record<string, AgentStatus> {
  const s = allIdleStatuses();
  for (const id of OFFICE_SALE_IDS) {
    if (live.sales[id]?.status === "working") s[id] = "working";
  }
  if (live.advisor?.status === "working") s.advisor = "working";
  if (live.qa.status === "review") s.quan = "review";
  if (live.manager.status === "working") s.huybot = "working";
  if (live.pending.length > 0) s.huy = "review";
  for (const a of OFFICE_AGENTS) {
    if (!a.museBot) continue;
    const m = live.muse.find((x) => x.bot === a.museBot);
    if (!m || !m.online) s[a.id] = "offline";
    else s[a.id] = m.taskCode ? "working" : "idle";
  }
  return s;
}

export function liveTaskText(
  agent: OfficeAgent,
  status: AgentStatus,
  live: OfficeLive,
): string {
  if (agent.museBot) {
    const m = live.muse.find((x) => x.bot === agent.museBot);
    if (!m || !m.lastSeen) return "Chưa từng báo nhịp sống";
    if (status === "offline") return "Không có nhịp sống từ bot";
    const n = m.threads?.filter((t) => t.online).length ?? 0;
    const w = m.working ?? 0;
    if (w > 1) return `Đang làm ${w} việc song song (${n} luồng): ${m.taskCode}...`;
    return m.taskCode ? `Đang làm việc ${m.taskCode}${n > 1 ? ` (${n} luồng)` : ""}` : `Rảnh, chờ việc mới${n > 1 ? ` (${n} luồng)` : ""}`;
  }
  const sale = live.sales[agent.id];
  if (sale) {
    if (sale.status === "working") return sale.task || "Đang tìm lead";
    if (sale.status === "queued") return `Đang chờ Muse nhận: ${sale.task}`;
    return "Chưa có việc";
  }
  if (agent.id === "advisor") {
    const a = live.advisor;
    if (a?.status === "working") return a.task || "Đang nghĩ cách tìm lead mới";
    if (a?.status === "queued") return `Đang chờ Muse nhận: ${a.task}`;
    return "Chưa có sale nào bí lead";
  }
  if (agent.id === "quan")
    return live.queue.cho_nap > 0
      ? `Kiểm tra ${live.queue.cho_nap} kết quả vừa về`
      : "Chưa có việc";
  if (agent.id === "huybot")
    return live.queue.dang_lam + live.queue.cho_giao > 0
      ? `Theo dõi ${live.queue.dang_lam + live.queue.cho_giao} việc đang chạy`
      : "Chưa có việc";
  if (agent.id === "huy")
    return live.pending.length > 0
      ? `Có ${live.pending.length} lead chờ duyệt`
      : "Không có lead chờ duyệt";
  return "Chưa có việc";
}
