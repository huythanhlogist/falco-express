// Danh sách "nhân viên ảo" của văn phòng AI Falco (trang /admin/van-phong).
// Trạng thái thật đọc từ n8n qua /api/admin/office/status (hàng đợi việc của
// Muse + heartbeat + bảng lead). Chế độ mô phỏng chỉ để xem thử giao diện.

export type AgentStatus = "idle" | "working" | "review" | "offline";

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
  { id: "huy", name: "Anh Huy", role: "Chủ doanh nghiệp, duyệt cuối trước khi gửi", deptId: "exec", kind: "human", deskX: -9, deskZ: -4.5 },
  { id: "huybot", name: "Huy-bot", role: "Quản lý: n8n giao việc hằng ngày cho Muse, tổng hợp kết quả", deptId: "exec", kind: "ai", deskX: -6, deskZ: -4.5 },
  { id: "linh", name: "Linh", role: "SALE-01: shop và cơ sở nhỏ bán đặc sản VN (EU, Anh), do Muse thực hiện", deptId: "sale", kind: "ai", deskX: -3, deskZ: -4.5 },
  { id: "nam", name: "Nam", role: "SALE-02: shop online nhỏ bán cho Việt kiều (Mỹ, Canada, Úc), do Muse thực hiện", deptId: "sale", kind: "ai", deskX: 0.5, deskZ: -4.5 },
  { id: "vy", name: "Vy", role: "SALE-03: đại lý và cộng tác viên, do Muse thực hiện", deptId: "sale", kind: "ai", deskX: 4, deskZ: -4.5 },
  { id: "mai", name: "Mai", role: "SALE-04: khách lẻ cá nhân gửi hàng đi châu Âu, do Muse thực hiện", deptId: "sale", kind: "ai", deskX: 7.5, deskZ: -4.5 },
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
  return "Tìm và chấm điểm lead theo target";
}

// ---- Dữ liệu thật từ n8n (webhook office/status) ----

export type OfficeLive = {
  ok: boolean;
  generatedAt: string;
  muse: {
    bot: string;
    lastSeen: string | null;
    online: boolean;
    stale: boolean;
    taskCode: string;
  }[];
  sales: Record<
    string,
    { status: "working" | "queued" | "idle"; task: string; taskCode: string; bot: string }
  >;
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
  for (const id of ["linh", "nam", "vy", "mai"]) {
    if (live.sales[id]?.status === "working") s[id] = "working";
  }
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
    return m.taskCode ? `Đang làm việc ${m.taskCode}` : "Rảnh, chờ việc mới";
  }
  const sale = live.sales[agent.id];
  if (sale) {
    if (sale.status === "working") return sale.task || "Đang tìm lead";
    if (sale.status === "queued") return `Đang chờ Muse nhận: ${sale.task}`;
    return "Chưa có việc";
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
