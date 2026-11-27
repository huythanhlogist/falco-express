import { getPool } from "./db";
import type { KangoTrackingResponse } from "./kango";
import { resolveLastMile } from "./last-mile";
import type { ShipmentStatus } from "./shipment-status";
import { vnDateString } from "./vn-date";
import { loadAlertDismissals, statusKey } from "./alert-dismissals";

// ---------- Kiểu dữ liệu công khai cho trang Tổng quan & API cảnh báo ----------

/** "YYYY-MM" = lọc theo 1 tháng cụ thể */
export type DashboardRange = "30d" | "quarter" | "year" | `${number}-${number}`;

export type DashboardOrderItem = {
  id: number;
  falcoCode: string;
  awb: string;
  recipientName: string;
  ctvName: string | null;
  country: string;
  carrier: string;
  /** Nhãn bên phải: giờ giao "09:42", trạng thái sắp giao, hoặc lý do cần chú ý */
  badge: string;
  /** Thời điểm liên quan (epoch ms) để sắp xếp */
  sortAt: number;
};

export type AlertReason = "failed_or_returned" | "customs_stuck" | "no_update";

export type DashboardAlertItem = DashboardOrderItem & {
  reason: AlertReason;
  shipmentStatus: ShipmentStatus | null;
};

export type AttentionSummary = {
  count: number;
  failedOrReturnedCount: number;
  customsStuckCount: number;
  staleCount: number;
  items: DashboardAlertItem[];
};

export type WeeklyWafflePoint = {
  weekStart: string; // "YYYY-MM-DD" (Thứ 2 giờ VN)
  weekEnd: string; // "YYYY-MM-DD" (Chủ nhật giờ VN)
  label: string; // "dd/mm"
  total: number;
  delivered: number;
  inProgress: number;
  isCurrent: boolean;
};

export type RouteBreakdownItem = {
  country: string;
  count: number;
  pct: number; // 0..100
  isOther: boolean;
};

export type FunnelStepItem = {
  key: "received" | "exported" | "customs_released" | "last_mile" | "delivered";
  label: string;
  count: number;
  pct: number; // 0..100
};

export type DashboardData = {
  range: DashboardRange;
  rangeLabel: string;
  rangeShortLabel: string;
  todayVn: string; // "YYYY-MM-DD"
  todayDisplayShort: string; // "dd/mm"
  todayDisplayFull: string; // "dd/mm/yyyy"
  lastSyncAt: number | null; // epoch ms
  today: {
    delivered: { count: number; items: DashboardOrderItem[]; allItems: DashboardOrderItem[] };
    upcoming: { count: number; items: DashboardOrderItem[]; allItems: DashboardOrderItem[] };
    attention: AttentionSummary & { allItems: DashboardAlertItem[] };
  };
  kpis: {
    thisMonthOrders: number;
    lastMonthOrders: number;
    monthDeltaPct: number | null;
    monthLabel: string; // "Tháng MM/YYYY"
    inTransitOrders: number;
    inTransitLastMile: number;
    inTransitCustoms: number;
    attentionCount: number;
    attentionCustoms: number;
    attentionStale: number;
    attentionFailed: number;
  };
  weekly: WeeklyWafflePoint[];
  /** 12 tháng gần nhất (kết thúc ở tháng đang lọc hoặc tháng hiện tại) — số đơn + % so với tháng trước */
  monthly: { ym: string; label: string; count: number; deltaPct: number | null; isSelected: boolean }[];
  /** "YYYY-MM" khi đang lọc theo 1 tháng (áp cho cả trang trừ card "Hôm nay"), ngược lại null */
  selectedMonth: string | null;
  weeklyLabel: string;
  routes: {
    total: number;
    items: RouteBreakdownItem[];
  };
  funnel: {
    total: number;
    steps: FunnelStepItem[];
    bottlenecks: {
      waitingExport: number;
      inCustoms: number;
      lastMile: number;
      inFlight: number;
      customsReleased: number;
      returned: number;
    };
  };
};

// ---------- Hằng số & biểu thức nhận diện sự kiện tracking ----------

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Ngưỡng cảnh báo đã chốt với chủ:
// - Kẹt hải quan > 2 ngày (> 48 giờ)
// - Không có cập nhật tracking > 3 ngày (> 72 giờ)
const CUSTOMS_STUCK_MS = 2 * DAY_MS;
const STALE_TRACKING_MS = 3 * DAY_MS;

// Cửa sổ vận hành cho cảnh báo & đơn đang xử lý (90 ngày để bao phủ cả tuyến đường biển,
// tránh kéo đơn lịch sử cũ từ trước khi có bảng cache tracking vào cảnh báo).
const ACTIVE_WINDOW_DAYS = 90;
// Đơn chưa từng có tracking: chỉ xét trong 30 ngày (cron tracking chỉ lấy 30 ngày,
// đơn cũ hơn không có dữ liệu → không đánh giá được, tránh báo nhầm hàng loạt).
const NO_CACHE_WINDOW_DAYS = 30;
const RETURNED_RECENT_MS = 30 * DAY_MS;
const RETURNED_ORDER_WINDOW_DAYS = 60;

// Đồng bộ với shipment-status.ts và bổ sung tiếng Việt của BayOnline ("Hoàn thành", "Đã giao").
const NEGATIVE_DELIVERED_RE = /\bnot\b.{0,40}\bdelivered\b|could not be delivered|thất bại|không giao được/i;
const DELIVERED_EVENT_RE = /\bdelivered\b|picked up|pick-up was successful|hoàn thành|đã giao/i;
const FAILURE_EVENT_RE =
  /could not be delivered|\bnot\b.{0,40}\bdelivered\b|delivery (attempt(ed)?|failed|unsuccessful)|failed delivery|undeliverable|refused by recipient|incorrect address|address issue|insufficient address|\bexception\b|giao thất bại|không giao được|đơn đã hủy/i;
const CUSTOMS_EVENT_RE = /destination customs|arrived destination airport|\bcustoms\b|thông quan|hải quan/i;
export const OUT_FOR_DELIVERY_RE = /out for delivery|with you today|delivery vehicle|đang giao hàng|đang phát/i;
const PICKUP_POINT_RE = /packstation|parcel shop|available for pickup|pick.?up point|chờ nhận/i;
const DEPOT_RE = /parcel cent(er|re)|depot|hub|facility|kho đầu cuối|đến bưu cục/i;

// ---------- Tiện ích ngày giờ Việt Nam (UTC+7, không phụ thuộc TZ tiến trình/MySQL) ----------

export function normalizeRange(raw: string | undefined): DashboardRange {
  if (raw === "30d" || raw === "quarter" || raw === "year") return raw;
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw as DashboardRange;
  return "quarter";
}

function parseYmdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatUtcMsToYmd(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  return formatUtcMsToYmd(parseYmdToUtcMs(ymd) + deltaDays * DAY_MS);
}

function formatYmdShort(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

function formatYmdFull(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Epoch ms ứng với 00:00:00 giờ VN của một ngày YYYY-MM-DD. */
function vnMidnightEpochMs(ymd: string): number {
  return parseYmdToUtcMs(ymd) - VN_OFFSET_MS;
}

/** Thứ 2 đầu tuần (giờ VN) chứa ngày ymd. */
function mondayOfWeekYmd(ymd: string): string {
  const utcMs = parseYmdToUtcMs(ymd);
  const dow = new Date(utcMs).getUTCDay(); // 0 = CN, 1 = T2 ... 6 = T7
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return formatUtcMsToYmd(utcMs + diffToMonday * DAY_MS);
}

function getMonthBoundsVn(todayVn: string): {
  thisMonthStart: string;
  nextMonthStart: string;
  prevMonthStart: string;
  monthLabel: string;
} {
  const [year, month] = todayVn.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const thisMonthStart = `${year}-${pad(month)}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthStart = `${nextYear}-${pad(nextMonth)}-01`;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthStart = `${prevYear}-${pad(prevMonth)}-01`;
  return {
    thisMonthStart,
    nextMonthStart,
    prevMonthStart,
    monthLabel: `Tháng ${pad(month)}/${year}`,
  };
}

function getRangeBoundsVn(
  range: DashboardRange,
  todayVn: string
): { startDate: string; endDate: string; label: string; shortLabel: string } {
  const [year, month] = todayVn.split("-").map(Number);
  if (/^\d{4}-\d{2}$/.test(range)) {
    const [ry, rm] = range.split("-").map(Number);
    const lastDay = new Date(Date.UTC(ry, rm, 0)).getUTCDate();
    const end = `${range}-${String(lastDay).padStart(2, "0")}`;
    return {
      startDate: `${range}-01`,
      endDate: end < todayVn ? end : todayVn,
      label: `Tháng ${rm}/${ry}`,
      shortLabel: `tháng ${rm}/${ry}`,
    };
  }
  if (range === "30d") {
    return {
      startDate: vnDateString(29),
      endDate: todayVn,
      label: "30 ngày gần nhất",
      shortLabel: "30 ngày qua",
    };
  }
  if (range === "year") {
    return {
      startDate: `${year}-01-01`,
      endDate: todayVn,
      label: `Năm ${year}`,
      shortLabel: "năm nay",
    };
  }
  const quarterIndex = Math.floor((month - 1) / 3); // 0..3
  const quarterStartMonth = String(quarterIndex * 3 + 1).padStart(2, "0");
  return {
    startDate: `${year}-${quarterStartMonth}-01`,
    endDate: todayVn,
    label: `Quý ${quarterIndex + 1}/${year}`,
    shortLabel: "quý này",
  };
}

export type ParsedVnTime = {
  dateVn: string; // "YYYY-MM-DD"
  hhmm: string; // "HH:mm"
  epochMs: number;
};

export function epochMsToVnTime(epochMs: number): ParsedVnTime {
  const iso = new Date(epochMs + VN_OFFSET_MS).toISOString();
  return {
    dateVn: iso.slice(0, 10),
    hhmm: iso.slice(11, 16),
    epochMs,
  };
}

/**
 * Đọc thời gian sự kiện tracking từ Kango hoặc BayOnline.
 * Cả hai lưu chuẩn "YYYY-MM-DD HH:mm:ss" theo giờ VN (xem bay-tracking.ts:60);
 * nếu chuỗi có múi giờ ISO (Z hoặc +07:00) thì tự quy đổi sang giờ VN.
 */
export function parseTrackingEventTime(raw: string | null | undefined): ParsedVnTime | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i
  );
  if (isoMatch) {
    const [, yStr, mStr, dStr, hhStr, mmStr, ssStr = "00", tz] = isoMatch;
    if (tz) {
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) return epochMsToVnTime(parsed);
    }
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    const ss = Number(ssStr);
    const epochMs = Date.UTC(y, m - 1, d, hh, mm, ss) - VN_OFFSET_MS;
    return {
      dateVn: `${yStr}-${mStr}-${dStr}`,
      hhmm: `${hhStr}:${mmStr}`,
      epochMs,
    };
  }

  // Dự phòng định dạng ngày/tháng/năm dd/mm/yyyy HH:mm(:ss)
  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (dmyMatch) {
    const [, dStr, mStr, yStr, hhStr, mmStr, ssStr = "00"] = dmyMatch;
    const epochMs =
      Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr), Number(hhStr), Number(mmStr), Number(ssStr)) -
      VN_OFFSET_MS;
    return {
      dateVn: `${yStr}-${mStr}-${dStr}`,
      hhmm: `${hhStr}:${mmStr}`,
      epochMs,
    };
  }

  return null;
}

// ---------- Chuẩn hoá tên nước & suy luận hãng chặng cuối ----------

/** Tên hiển thị trên trang Tổng quan: tiếng Anh (chủ yêu cầu 27/11/2026). */
const COUNTRY_EN: Record<string, string> = {
  Anh: "United Kingdom", "Ba Lan": "Poland", "Bỉ": "Belgium", "Bồ Đào Nha": "Portugal", "Châu Âu": "Europe",
  "Hà Lan": "Netherlands", "Hàn Quốc": "South Korea", "Mỹ": "United States", "Na Uy": "Norway",
  "Nhật Bản": "Japan", "Pháp": "France", "Phần Lan": "Finland", "Séc": "Czech Republic", "Thụy Sĩ": "Switzerland",
  "Thụy Điển": "Sweden", "Tây Ban Nha": "Spain", "Áo": "Austria", "Úc": "Australia", "Ý": "Italy",
  "Đan Mạch": "Denmark", "Đài Loan": "Taiwan", "Đức": "Germany",
};

const COUNTRY_MAP: Record<string, string> = {
  US: "Mỹ",
  USA: "Mỹ",
  "UNITED STATES": "Mỹ",
  "UNITED STATES OF AMERICA": "Mỹ",
  MY: "Mỹ",
  "MỸ": "Mỹ",
  AU: "Úc",
  AUS: "Úc",
  AUSTRALIA: "Úc",
  UC: "Úc",
  "ÚC": "Úc",
  CA: "Canada",
  CAN: "Canada",
  CANADA: "Canada",
  JP: "Nhật Bản",
  JPN: "Nhật Bản",
  JAPAN: "Nhật Bản",
  NHAT: "Nhật Bản",
  "NHẬT": "Nhật Bản",
  "NHẬT BẢN": "Nhật Bản",
  KR: "Hàn Quốc",
  KOR: "Hàn Quốc",
  KOREA: "Hàn Quốc",
  "SOUTH KOREA": "Hàn Quốc",
  HAN: "Hàn Quốc",
  "HÀN": "Hàn Quốc",
  "HÀN QUỐC": "Hàn Quốc",
  DE: "Đức",
  DEU: "Đức",
  GERMANY: "Đức",
  DUC: "Đức",
  "ĐỨC": "Đức",
  GB: "Anh",
  UK: "Anh",
  "UNITED KINGDOM": "Anh",
  ENGLAND: "Anh",
  ANH: "Anh",
  FR: "Pháp",
  FRA: "Pháp",
  FRANCE: "Pháp",
  PHAP: "Pháp",
  "PHÁP": "Pháp",
  PL: "Ba Lan",
  POL: "Ba Lan",
  POLAND: "Ba Lan",
  "BA LAN": "Ba Lan",
  CZ: "Séc",
  CZE: "Séc",
  CZECH: "Séc",
  "CZECH REPUBLIC": "Séc",
  "CZECHIA": "Séc",
  SEC: "Séc",
  "SÉC": "Séc",
  NL: "Hà Lan",
  NLD: "Hà Lan",
  NETHERLANDS: "Hà Lan",
  HOLLAND: "Hà Lan",
  "HA LAN": "Hà Lan",
  "HÀ LAN": "Hà Lan",
  ES: "Tây Ban Nha",
  ESP: "Tây Ban Nha",
  SPAIN: "Tây Ban Nha",
  "TAY BAN NHA": "Tây Ban Nha",
  "TÂY BAN NHA": "Tây Ban Nha",
  IT: "Ý",
  ITA: "Ý",
  ITALY: "Ý",
  Y: "Ý",
  "Ý": "Ý",
  AT: "Áo",
  AUT: "Áo",
  AUSTRIA: "Áo",
  AO: "Áo",
  "ÁO": "Áo",
  BE: "Bỉ",
  BEL: "Bỉ",
  BELGIUM: "Bỉ",
  BI: "Bỉ",
  "BỈ": "Bỉ",
  SE: "Thụy Điển",
  SWE: "Thụy Điển",
  SWEDEN: "Thụy Điển",
  "THUY DIEN": "Thụy Điển",
  "THỤY ĐIỂN": "Thụy Điển",
  DK: "Đan Mạch",
  DNK: "Đan Mạch",
  DENMARK: "Đan Mạch",
  "DAN MACH": "Đan Mạch",
  "ĐAN MẠCH": "Đan Mạch",
  CH: "Thụy Sĩ",
  CHE: "Thụy Sĩ",
  SWITZERLAND: "Thụy Sĩ",
  "THUY SI": "Thụy Sĩ",
  "THỤY SĨ": "Thụy Sĩ",
  IE: "Ireland",
  IRL: "Ireland",
  IRELAND: "Ireland",
  SK: "Slovakia",
  SVK: "Slovakia",
  SLOVAKIA: "Slovakia",
  HU: "Hungary",
  HUN: "Hungary",
  HUNGARY: "Hungary",
  RO: "Romania",
  ROU: "Romania",
  ROMANIA: "Romania",
  PT: "Bồ Đào Nha",
  PRT: "Bồ Đào Nha",
  PORTUGAL: "Bồ Đào Nha",
  "BO DAO NHA": "Bồ Đào Nha",
  "BỒ ĐÀO NHA": "Bồ Đào Nha",
  NO: "Na Uy",
  NOR: "Na Uy",
  NORWAY: "Na Uy",
  "NA UY": "Na Uy",
  FI: "Phần Lan",
  FIN: "Phần Lan",
  FINLAND: "Phần Lan",
  "PHAN LAN": "Phần Lan",
  "PHẦN LAN": "Phần Lan",
  SG: "Singapore",
  SGP: "Singapore",
  SINGAPORE: "Singapore",
  TW: "Đài Loan",
  TWN: "Đài Loan",
  TAIWAN: "Đài Loan",
  "DAI LOAN": "Đài Loan",
  "ĐÀI LOAN": "Đài Loan",
  EU: "Châu Âu",
  EUROPE: "Châu Âu",
  "CHAU AU": "Châu Âu",
  "CHÂU ÂU": "Châu Âu",
};

function normalizeCountryName(raw: string | null | undefined): string {
  if (!raw) return "";
  let cleaned = raw.trim();
  if (!cleaned) return "";
  // Dạng "VN -> DE" của BayOnline/Kango
  const arrowMatch = cleaned.match(/^(?:VN|VIETNAM)\s*->\s*(.+)$/i);
  if (arrowMatch) cleaned = arrowMatch[1].trim();
  // Dạng "Thành phố, Nước" (vd "Berlin, Germany", "berlin, Đức"): lấy phần sau dấu phẩy cuối
  if (cleaned.includes(",")) cleaned = cleaned.slice(cleaned.lastIndexOf(",") + 1).trim();
  const key = cleaned.toUpperCase();
  const vn = COUNTRY_MAP[key] ?? cleaned;
  return COUNTRY_EN[vn] ?? vn;
}

export function parseKangoPayload(raw: string | null): KangoTrackingResponse | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KangoTrackingResponse;
  } catch {
    return null;
  }
}

export type OrderTrackingQueryRow = {
  id: number;
  falco_code: string;
  awb: string;
  recipient_name: string | null;
  service: string | null;
  destination: string | null;
  order_date: string | null;
  ctv_full_name: string | null;
  shipment_status: ShipmentStatus | null;
  current_status: string | null;
  payload: string | null;
  fetched_at: number | string | null;
};

export function resolveOrderMeta(row: OrderTrackingQueryRow, kango: KangoTrackingResponse | null): {
  recipientName: string;
  country: string;
  carrier: string;
} {
  const recipientName = row.recipient_name?.trim() || "Khách lẻ";
  const country =
    normalizeCountryName(kango?.additional_notes?.country) ||
    normalizeCountryName(row.destination) ||
    normalizeCountryName(kango?.shipment_information?.country) ||
    "Quốc tế";
  const trackingCode =
    kango?.package_tracking_code ||
    kango?.shipment_information?.order_numbers?.[0]?.package_tracking_code ||
    "";
  const resolved = resolveLastMile(trackingCode, {
    service: kango?.additional_notes?.service || row.service || "",
    carrier: kango?.additional_notes?.last_mile || kango?.carrier_code || "",
  });
  const carrier = resolved.carrier || (row.falco_code.toUpperCase().startsWith("FEB") ? "BayOnline" : "Kango");
  return { recipientName, country, carrier };
}

// ---------- Phân tích 3 cột "Hôm nay" và danh sách "Cần chú ý" ----------

export function extractDeliveredTime(
  kango: KangoTrackingResponse | null,
  fetchedAtMs: number | null
): ParsedVnTime | null {
  const events = kango?.trackings ?? [];
  let best: ParsedVnTime | null = null;
  for (const ev of events) {
    const title = ev.title ?? "";
    if (!DELIVERED_EVENT_RE.test(title) || NEGATIVE_DELIVERED_RE.test(title)) continue;
    const parsed = parseTrackingEventTime(ev.time);
    if (parsed && (!best || parsed.epochMs > best.epochMs)) {
      best = parsed;
    }
  }
  if (best) return best;
  // Dự phòng: khi payload chưa có sự kiện giao rõ ràng, dùng fetched_at vì cron
  // dừng làm mới ngay khi đơn chuyển sang delivered — đây là mốc gần nhất có thể suy ra.
  if (fetchedAtMs && fetchedAtMs > 0) {
    return epochMsToVnTime(fetchedAtMs);
  }
  return null;
}

function getLatestEvent(kango: KangoTrackingResponse | null): {
  title: string;
  time: ParsedVnTime | null;
} {
  const events = kango?.trackings ?? [];
  if (events.length === 0) return { title: "", time: null };

  let bestTitle = events[0]?.title ?? "";
  let bestTime = parseTrackingEventTime(events[0]?.time);

  for (const ev of events) {
    const parsed = parseTrackingEventTime(ev.time);
    if (parsed && (!bestTime || parsed.epochMs > bestTime.epochMs)) {
      bestTime = parsed;
      bestTitle = ev.title ?? "";
    }
  }
  return { title: bestTitle, time: bestTime };
}

function getCustomsEntryEpochMs(
  kango: KangoTrackingResponse | null,
  fallbackOrderDate: string | null,
  fetchedAtMs: number | null
): number | null {
  const events = kango?.trackings ?? [];
  let earliestCustoms: number | null = null;
  let latestAny: number | null = null;

  for (const ev of events) {
    const parsed = parseTrackingEventTime(ev.time);
    if (!parsed) continue;
    if (latestAny === null || parsed.epochMs > latestAny) latestAny = parsed.epochMs;
    if (CUSTOMS_EVENT_RE.test(ev.title ?? "")) {
      if (earliestCustoms === null || parsed.epochMs < earliestCustoms) {
        earliestCustoms = parsed.epochMs;
      }
    }
  }

  if (earliestCustoms !== null) return earliestCustoms;
  if (latestAny !== null) return latestAny;
  if (fallbackOrderDate) return vnMidnightEpochMs(fallbackOrderDate) + 12 * 3600_000;
  if (fetchedAtMs && fetchedAtMs > 0) return fetchedAtMs;
  return null;
}

function resolveUpcomingBadge(kango: KangoTrackingResponse | null, currentStatus: string | null): string {
  const latest = getLatestEvent(kango);
  const text = `${latest.title} ${currentStatus ?? ""}`;
  if (OUT_FOR_DELIVERY_RE.test(text)) return "Đang giao";
  if (PICKUP_POINT_RE.test(text)) return "Chờ nhận tại điểm";
  if (DEPOT_RE.test(text)) return "Tại bưu cục đến";
  return "Chặng cuối";
}

function evaluateActiveRows(
  rows: OrderTrackingQueryRow[],
  nowMs: number
): {
  upcomingItems: DashboardOrderItem[];
  attention: AttentionSummary;
} {
  const upcomingItems: DashboardOrderItem[] = [];
  const attentionItems: (DashboardAlertItem & { priority: number })[] = [];

  let failedOrReturnedCount = 0;
  let customsStuckCount = 0;
  let staleCount = 0;

  for (const row of rows) {
    const kango = parseKangoPayload(row.payload);
    const meta = resolveOrderMeta(row, kango);
    const fetchedAtMs = row.fetched_at !== null ? Number(row.fetched_at) : null;
    const latestEv = getLatestEvent(kango);
    const latestActivityMs =
      latestEv.time?.epochMs ??
      (row.order_date ? vnMidnightEpochMs(row.order_date) + 12 * 3600_000 : null) ??
      fetchedAtMs ??
      nowMs;

    const status = row.shipment_status;

    // 1. Cột Sắp giao: các đơn đang ở chặng cuối (last_mile)
    if (status === "last_mile") {
      upcomingItems.push({
        id: row.id,
        falcoCode: row.falco_code,
        awb: row.awb,
        recipientName: meta.recipientName,
        ctvName: row.ctv_full_name,
        country: meta.country,
        carrier: meta.carrier,
        badge: resolveUpcomingBadge(kango, row.current_status),
        sortAt: latestActivityMs,
      });
    }

    // 2. Cột Cần chú ý & Chuông cảnh báo (mỗi đơn chỉ tính 1 lần theo mức ưu tiên cao nhất)
    const latestText = `${latestEv.title} ${row.current_status ?? ""}`;
    const isReturned = status === "returned";
    const isFailedDelivery =
      status !== "delivered" && !isReturned && FAILURE_EVENT_RE.test(latestText);

    if (isReturned || isFailedDelivery) {
      failedOrReturnedCount++;
      attentionItems.push({
        id: row.id,
        falcoCode: row.falco_code,
        awb: row.awb,
        recipientName: meta.recipientName,
        ctvName: row.ctv_full_name,
        country: meta.country,
        carrier: meta.carrier,
        badge: isReturned ? "Hoàn trả" : "Giao thất bại",
        reason: "failed_or_returned",
        shipmentStatus: status,
        sortAt: latestActivityMs,
        priority: 1,
      });
      continue;
    }

    if (status === "customs_processing" || status === "customs") {
      const customsSinceMs = getCustomsEntryEpochMs(kango, row.order_date, fetchedAtMs);
      if (customsSinceMs !== null && nowMs - customsSinceMs > CUSTOMS_STUCK_MS) {
        const days = Math.floor((nowMs - customsSinceMs) / DAY_MS);
        customsStuckCount++;
        attentionItems.push({
          id: row.id,
          falcoCode: row.falco_code,
          awb: row.awb,
          recipientName: meta.recipientName,
          ctvName: row.ctv_full_name,
          country: meta.country,
          carrier: meta.carrier,
          badge: days > 2 ? `Kẹt hải quan ${days} ngày` : "Kẹt hải quan >2 ngày",
          reason: "customs_stuck",
          shipmentStatus: status,
          sortAt: customsSinceMs, // kẹt lâu nhất đứng trước
          priority: 2,
        });
        continue;
      }
    }

    if (status !== "delivered") {
      if (nowMs - latestActivityMs > STALE_TRACKING_MS) {
        const days = Math.floor((nowMs - latestActivityMs) / DAY_MS);
        staleCount++;
        attentionItems.push({
          id: row.id,
          falcoCode: row.falco_code,
          awb: row.awb,
          recipientName: meta.recipientName,
          ctvName: row.ctv_full_name,
          country: meta.country,
          carrier: meta.carrier,
          badge: days > 3 ? `Chưa cập nhật ${days} ngày` : "Chưa cập nhật >3 ngày",
          reason: "no_update",
          shipmentStatus: status,
          sortAt: latestActivityMs, // chậm lâu nhất đứng trước
          priority: 3,
        });
      }
    }
  }

  upcomingItems.sort((a, b) => b.sortAt - a.sortAt || b.id - a.id);

  // Sắp xếp cảnh báo: lỗi giao/hoàn trả mới nhất → kẹt hải quan lâu nhất → chậm cập nhật lâu nhất
  attentionItems.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.priority === 1) return b.sortAt - a.sortAt || b.id - a.id;
    return a.sortAt - b.sortAt || b.id - a.id;
  });

  const cleanAttentionItems: DashboardAlertItem[] = attentionItems.map((item) => ({
    id: item.id,
    falcoCode: item.falcoCode,
    awb: item.awb,
    recipientName: item.recipientName,
    ctvName: item.ctvName,
    country: item.country,
    carrier: item.carrier,
    badge: item.badge,
    sortAt: item.sortAt,
    reason: item.reason,
    shipmentStatus: item.shipmentStatus,
  }));

  return {
    upcomingItems,
    attention: {
      count: cleanAttentionItems.length,
      failedOrReturnedCount,
      customsStuckCount,
      staleCount,
      items: cleanAttentionItems,
    },
  };
}

async function queryActiveAndRecentReturnedOrders(nowMs: number): Promise<OrderTrackingQueryRow[]> {
  const activeWindowStart = vnDateString(ACTIVE_WINDOW_DAYS);
  const returnedFetchedSinceMs = nowMs - RETURNED_RECENT_MS;
  const returnedOrderSinceDate = vnDateString(RETURNED_ORDER_WINDOW_DAYS);

  const [rows] = await getPool().query(
    `SELECT
       o.id, o.falco_code, o.awb, o.recipient_name, o.service, o.destination,
       DATE_FORMAT(COALESCE(o.received_date, DATE(o.created_at)), '%Y-%m-%d') AS order_date,
       c.full_name AS ctv_full_name,
       tc.shipment_status, tc.current_status, tc.payload, tc.fetched_at
     FROM orders o
     LEFT JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
     LEFT JOIN ctv_users c ON c.id = o.ctv_id
     WHERE o.review_status <> 'rejected'
       AND (
         (tc.order_id IS NOT NULL AND tc.shipment_status NOT IN ('delivered', 'returned')
          AND COALESCE(o.received_date, DATE(o.created_at)) >= ?)
         OR (tc.order_id IS NULL AND COALESCE(o.received_date, DATE(o.created_at)) >= ?)
         OR (tc.shipment_status = 'returned'
             AND (tc.fetched_at >= ? OR COALESCE(o.received_date, DATE(o.created_at)) >= ?))
       )
     ORDER BY o.id DESC`,
    [activeWindowStart, vnDateString(NO_CACHE_WINDOW_DAYS), returnedFetchedSinceMs, returnedOrderSinceDate]
  );

  return rows as OrderTrackingQueryRow[];
}

/** Bỏ các đơn đã bấm Ẩn (trạng thái chưa đổi kể từ lúc ẩn) và đếm lại. */
async function applyDismissals(
  attention: AttentionSummary,
  dismissedP: Promise<Map<number, string>> = loadAlertDismissals()
): Promise<AttentionSummary> {
  let dismissed: Map<number, string>;
  try {
    dismissed = await dismissedP;
  } catch (err) {
    console.error("[dashboard] Không đọc được danh sách cảnh báo đã ẩn:", err);
    return attention;
  }
  if (dismissed.size === 0) return attention;
  const items = attention.items.filter((i) => dismissed.get(i.id) !== statusKey(i.shipmentStatus));
  return {
    count: items.length,
    failedOrReturnedCount: items.filter((i) => i.reason === "failed_or_returned").length,
    customsStuckCount: items.filter((i) => i.reason === "customs_stuck").length,
    staleCount: items.filter((i) => i.reason === "no_update").length,
    items,
  };
}

// ---------- API công khai: đơn đã giao trong 1 ngày bất kỳ (trang /admin/tong-quan/da-giao?ngay=) ----------

/**
 * Đơn giao trong ngày `dateVn` (YYYY-MM-DD, giờ VN). Cron chỉ ghi nhận "delivered" SAU lúc giao,
 * nên chỉ cần xét đơn delivered có fetched_at từ (ngày đó − 1 ngày) trở đi, rồi lọc theo ngày giao.
 */
export async function getDeliveredOnDate(dateVn: string): Promise<DashboardOrderItem[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateVn)) return [];
  const sinceMs = vnMidnightEpochMs(dateVn) - DAY_MS;
  const [rows] = await getPool().query(
    `SELECT
       o.id, o.falco_code, o.awb, o.recipient_name, o.service, o.destination,
       DATE_FORMAT(COALESCE(o.received_date, DATE(o.created_at)), '%Y-%m-%d') AS order_date,
       c.full_name AS ctv_full_name,
       tc.shipment_status, tc.current_status, tc.payload, tc.fetched_at
     FROM orders o
     INNER JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
     LEFT JOIN ctv_users c ON c.id = o.ctv_id
     WHERE o.review_status <> 'rejected'
       AND tc.shipment_status = 'delivered'
       AND tc.fetched_at >= ?
     ORDER BY tc.fetched_at DESC, o.id DESC`,
    [sinceMs]
  );
  const items: DashboardOrderItem[] = [];
  for (const row of rows as OrderTrackingQueryRow[]) {
    const kango = parseKangoPayload(row.payload);
    const fetchedAtMs = row.fetched_at !== null ? Number(row.fetched_at) : null;
    const deliveredTime = extractDeliveredTime(kango, fetchedAtMs);
    if (!deliveredTime || deliveredTime.dateVn !== dateVn) continue;
    const meta = resolveOrderMeta(row, kango);
    items.push({
      id: row.id,
      falcoCode: row.falco_code,
      awb: row.awb,
      recipientName: meta.recipientName,
      ctvName: row.ctv_full_name,
      country: meta.country,
      carrier: meta.carrier,
      badge: deliveredTime.hhmm || dateVn.slice(8, 10) + "/" + dateVn.slice(5, 7),
      sortAt: deliveredTime.epochMs,
    });
  }
  return items.sort((a, b) => b.sortAt - a.sortAt || b.id - a.id);
}

// ---------- API công khai: dùng cho GET /api/admin/dashboard/alerts ----------

export async function getAttentionAlerts(limit = 10): Promise<{
  count: number;
  items: DashboardAlertItem[];
  updatedAt: number;
}> {
  const nowMs = Date.now();
  const dismissedP = loadAlertDismissals();
  dismissedP.catch(() => {}); // lỗi xử lý trong applyDismissals
  const rows = await queryActiveAndRecentReturnedOrders(nowMs);
  const attention = await applyDismissals(evaluateActiveRows(rows, nowMs).attention, dismissedP);
  return {
    count: attention.count,
    items: attention.items.slice(0, Math.max(1, limit)),
    updatedAt: nowMs,
  };
}

// ---------- API công khai: toàn bộ dữ liệu cho trang /admin/tong-quan ----------

export async function getDashboardData(rangeInput?: string): Promise<DashboardData> {
  const nowMs = Date.now();
  const range = normalizeRange(rangeInput);
  const todayVn = vnDateString(0);
  const rangeBounds = getRangeBoundsVn(range, todayVn);
  const selectedMonth = /^\d{4}-\d{2}$/.test(range) ? range : null;
  // Lọc tháng: 3 ô KPI, biểu đồ tuần, đơn theo nước, quy trình đều tính theo tháng đó.
  const monthBounds = getMonthBoundsVn(selectedMonth ? `${selectedMonth}-01` : todayVn);
  const inSelectedMonth = (orderDate: string | null) =>
    !selectedMonth || (!!orderDate && orderDate >= rangeBounds.startDate && orderDate <= rangeBounds.endDate);

  const currentWeekMonday = mondayOfWeekYmd(todayVn);
  // Không lọc tháng: 11 tuần gần nhất (gồm tuần này). Lọc tháng: các tuần chạm vào tháng đó.
  const waffleLastMonday = selectedMonth ? mondayOfWeekYmd(rangeBounds.endDate) : currentWeekMonday;
  const waffleStartDate = selectedMonth ? mondayOfWeekYmd(rangeBounds.startDate) : addDaysYmd(currentWeekMonday, -10 * 7);
  const waffleEndDate = selectedMonth ? addDaysYmd(waffleLastMonday, 6) : todayVn;
  const activeWindowStart = vnDateString(ACTIVE_WINDOW_DAYS);
  // Cron không lấy lại tracking của đơn đã giao → lần lấy ghi nhận "delivered" luôn xảy ra SAU
  // lúc giao. Đơn giao hôm nay chắc chắn có fetched_at từ hôm nay; lùi thêm 1 ngày cho an toàn.
  // (Trước đây lấy cả đơn 60 ngày → ~440KB payload mỗi lần mở trang.)
  const deliveredFetchedSinceMs = vnMidnightEpochMs(todayVn) - DAY_MS;

  const pool = getPool();

  const lastSyncP = pool.query(
    "SELECT MAX(fetched_at) AS last_fetched_at FROM order_tracking_cache"
  );

  const monthKpiP = pool.query(
    `SELECT
       SUM(CASE WHEN COALESCE(received_date, DATE(created_at)) >= ? AND COALESCE(received_date, DATE(created_at)) < ? THEN 1 ELSE 0 END) AS this_month,
       SUM(CASE WHEN COALESCE(received_date, DATE(created_at)) >= ? AND COALESCE(received_date, DATE(created_at)) < ? THEN 1 ELSE 0 END) AS last_month
     FROM orders
     WHERE review_status <> 'rejected'
       AND COALESCE(received_date, DATE(created_at)) >= ?
       AND COALESCE(received_date, DATE(created_at)) < ?`,
    [
      monthBounds.thisMonthStart,
      monthBounds.nextMonthStart,
      monthBounds.prevMonthStart,
      monthBounds.thisMonthStart,
      monthBounds.prevMonthStart,
      monthBounds.nextMonthStart,
    ]
  );

  const inTransitKpiP = pool.query(
    `SELECT
       COUNT(*) AS total_in_transit,
       SUM(CASE WHEN tc.shipment_status = 'last_mile' THEN 1 ELSE 0 END) AS last_mile_count,
       SUM(CASE WHEN tc.shipment_status IN ('customs_processing', 'customs') THEN 1 ELSE 0 END) AS customs_count
     FROM orders o
     LEFT JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
     WHERE o.review_status <> 'rejected'
       AND (
         (tc.order_id IS NOT NULL AND tc.shipment_status NOT IN ('delivered', 'returned'))
         OR (tc.order_id IS NULL AND COALESCE(o.received_date, DATE(o.created_at)) >= ?)
       )
       AND COALESCE(o.received_date, DATE(o.created_at)) BETWEEN ? AND ?`,
    [
      vnDateString(NO_CACHE_WINDOW_DAYS),
      selectedMonth ? rangeBounds.startDate : "1970-01-01",
      selectedMonth ? rangeBounds.endDate : "9999-12-31",
    ]
  );

  const deliveredCandidatesP = pool.query(
    `SELECT
       o.id, o.falco_code, o.awb, o.recipient_name, o.service, o.destination,
       DATE_FORMAT(COALESCE(o.received_date, DATE(o.created_at)), '%Y-%m-%d') AS order_date,
       c.full_name AS ctv_full_name,
       tc.shipment_status, tc.current_status, tc.payload, tc.fetched_at
     FROM orders o
     INNER JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
     LEFT JOIN ctv_users c ON c.id = o.ctv_id
     WHERE o.review_status <> 'rejected'
       AND tc.shipment_status = 'delivered'
       AND tc.fetched_at >= ?
     ORDER BY tc.fetched_at DESC, o.id DESC`,
    [deliveredFetchedSinceMs]
  );

  const activeRowsP = queryActiveAndRecentReturnedOrders(nowMs);
  const dismissedP = loadAlertDismissals();
  dismissedP.catch(() => {}); // lỗi xử lý trong applyDismissals

  // Biểu đồ 12 tháng (lấy thêm 1 tháng trước đó để tính % của cột đầu)
  const monthlyEnd = selectedMonth ?? todayVn.slice(0, 7);
  const monthKeys: string[] = [];
  {
    const [ey, em] = monthlyEnd.split("-").map(Number);
    for (let i = 12; i >= 0; i--) {
      const d = new Date(Date.UTC(ey, em - 1 - i, 1));
      monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
  }
  const monthlyRowsP = pool.query(
    `SELECT DATE_FORMAT(COALESCE(received_date, DATE(created_at)), '%Y-%m') AS ym, COUNT(*) AS n
     FROM orders
     WHERE review_status <> 'rejected'
       AND COALESCE(received_date, DATE(created_at)) >= ?
       AND COALESCE(received_date, DATE(created_at)) <= ?
     GROUP BY ym`,
    [`${monthKeys[0]}-01`, `${monthlyEnd}-31`]
  );

  const weeklyRowsP = pool.query(
    `SELECT
       DATE_FORMAT(COALESCE(o.received_date, DATE(o.created_at)), '%Y-%m-%d') AS order_date,
       COUNT(*) AS total_count,
       SUM(CASE WHEN tc.shipment_status = 'delivered' THEN 1 ELSE 0 END) AS delivered_count
     FROM orders o
     LEFT JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
     WHERE o.review_status <> 'rejected'
       AND COALESCE(o.received_date, DATE(o.created_at)) >= ?
       AND COALESCE(o.received_date, DATE(o.created_at)) <= ?
     GROUP BY order_date`,
    // Lọc tháng: tuần vắt qua 2 tháng vẫn đếm đủ 7 ngày (nếu chỉ đếm phần trong tháng,
    // tuần đầu có thể chỉ còn 1 ngày Chủ nhật → cột trống).
    [waffleStartDate, waffleEndDate]
  );

  const routesRowsP = pool.query(
    `SELECT
       COALESCE(NULLIF(TRIM(o.destination), ''), '') AS dest_name,
       COUNT(*) AS order_count
     FROM orders o
     WHERE o.review_status <> 'rejected'
       AND COALESCE(o.received_date, DATE(o.created_at)) >= ?
       AND COALESCE(o.received_date, DATE(o.created_at)) <= ?
     GROUP BY dest_name
     ORDER BY order_count DESC`,
    [rangeBounds.startDate, rangeBounds.endDate]
  );

  const funnelRowsP = pool.query(
    `SELECT
       COALESCE(tc.shipment_status, 'received') AS status_key,
       COUNT(*) AS order_count
     FROM orders o
     LEFT JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
     WHERE o.review_status <> 'rejected'
       AND COALESCE(o.received_date, DATE(o.created_at)) >= ?
       AND COALESCE(o.received_date, DATE(o.created_at)) <= ?
     GROUP BY status_key`,
    [rangeBounds.startDate, rangeBounds.endDate]
  );

  const [
    [lastSyncRows],
    [monthKpiRows],
    [inTransitRows],
    [deliveredRows],
    activeRows,
    [weeklyRows],
    [routesRows],
    [funnelRows],
  ] = await Promise.all([
    lastSyncP,
    monthKpiP,
    inTransitKpiP,
    deliveredCandidatesP,
    activeRowsP,
    weeklyRowsP,
    routesRowsP,
    funnelRowsP,
  ]);

  // 1. Thời điểm đồng bộ tracking gần nhất
  const rawLastSync = (lastSyncRows as { last_fetched_at: number | string | null }[])[0]?.last_fetched_at;
  const lastSyncAt = rawLastSync !== null && rawLastSync !== undefined ? Number(rawLastSync) : null;

  // 2. KPI tháng này vs tháng trước
  const monthRow = (monthKpiRows as { this_month: number | string | null; last_month: number | string | null }[])[0];
  const thisMonthOrders = Number(monthRow?.this_month ?? 0);
  const lastMonthOrders = Number(monthRow?.last_month ?? 0);
  const monthDeltaPct =
    lastMonthOrders > 0 ? Math.round(((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100) : null;

  // 3. KPI đang trên đường
  const transitRow = (
    inTransitRows as {
      total_in_transit: number | string | null;
      last_mile_count: number | string | null;
      customs_count: number | string | null;
    }[]
  )[0];
  const inTransitOrders = Number(transitRow?.total_in_transit ?? 0);
  const inTransitLastMile = Number(transitRow?.last_mile_count ?? 0);
  const inTransitCustoms = Number(transitRow?.customs_count ?? 0);

  // 4. Đã giao hôm nay (giờ VN)
  const deliveredTodayItems: DashboardOrderItem[] = [];
  for (const row of deliveredRows as OrderTrackingQueryRow[]) {
    const kango = parseKangoPayload(row.payload);
    const fetchedAtMs = row.fetched_at !== null ? Number(row.fetched_at) : null;
    const deliveredTime = extractDeliveredTime(kango, fetchedAtMs);
    if (!deliveredTime || deliveredTime.dateVn !== todayVn) continue;
    const meta = resolveOrderMeta(row, kango);
    deliveredTodayItems.push({
      id: row.id,
      falcoCode: row.falco_code,
      awb: row.awb,
      recipientName: meta.recipientName,
      ctvName: row.ctv_full_name,
      country: meta.country,
      carrier: meta.carrier,
      badge: deliveredTime.hhmm || "Hôm nay",
      sortAt: deliveredTime.epochMs,
    });
  }
  deliveredTodayItems.sort((a, b) => b.sortAt - a.sortAt || b.id - a.id);

  // 5. Sắp giao + Cần chú ý
  const evaluated = evaluateActiveRows(activeRows, nowMs);
  const upcomingItems = evaluated.upcomingItems;
  const attention = await applyDismissals(evaluated.attention, dismissedP);
  // Ô KPI "Cần chú ý" theo tháng đang lọc (card "Hôm nay" vẫn là toàn bộ)
  const kpiAttention = selectedMonth
    ? await applyDismissals(
        evaluateActiveRows(
          (activeRows as OrderTrackingQueryRow[]).filter((r) => inSelectedMonth(r.order_date)),
          nowMs
        ).attention,
        dismissedP
      )
    : attention;

  // 6. Biểu đồ 11 tuần gần nhất (gom theo tuần Thứ 2 → Chủ nhật giờ VN)
  const weekBuckets = new Map<string, { total: number; delivered: number }>();
  const weekStarts: string[] = [];
  for (let ws = waffleStartDate; ws <= waffleLastMonday; ws = addDaysYmd(ws, 7)) {
    weekStarts.push(ws);
    weekBuckets.set(ws, { total: 0, delivered: 0 });
  }
  for (const r of weeklyRows as { order_date: string | null; total_count: number | string; delivered_count: number | string | null }[]) {
    if (!r.order_date) continue;
    const ws = mondayOfWeekYmd(r.order_date);
    const bucket = weekBuckets.get(ws);
    if (!bucket) continue;
    bucket.total += Number(r.total_count ?? 0);
    bucket.delivered += Number(r.delivered_count ?? 0);
  }
  const weekly: WeeklyWafflePoint[] = weekStarts.map((ws, idx) => {
    const bucket = weekBuckets.get(ws) ?? { total: 0, delivered: 0 };
    return {
      weekStart: ws,
      weekEnd: addDaysYmd(ws, 6),
      label: formatYmdShort(ws),
      total: bucket.total,
      delivered: bucket.delivered,
      inProgress: Math.max(0, bucket.total - bucket.delivered),
      isCurrent: selectedMonth ? ws === currentWeekMonday : idx === weekStarts.length - 1,
    };
  });

  // 7. Đơn theo tuyến (top 6 + Khác)
  const countryTotals = new Map<string, number>();
  let otherCount = 0;
  let routesTotal = 0;

  for (const r of routesRows as { dest_name: string; order_count: number | string }[]) {
    const count = Number(r.order_count ?? 0);
    if (count <= 0) continue;
    routesTotal += count;
    const name = normalizeCountryName(r.dest_name);
    if (!name || name === "Khác") {
      otherCount += count;
    } else {
      countryTotals.set(name, (countryTotals.get(name) ?? 0) + count);
    }
  }

  const sortedCountries = [...countryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const topCountries = sortedCountries.slice(0, 6);
  for (const [, cnt] of sortedCountries.slice(6)) {
    otherCount += cnt;
  }

  const routeItems: RouteBreakdownItem[] = topCountries.map(([country, count]) => ({
    country,
    count,
    pct: routesTotal > 0 ? Math.round((count / routesTotal) * 100) : 0,
    isOther: false,
  }));
  if (otherCount > 0) {
    routeItems.push({
      country: "Khác",
      count: otherCount,
      pct: routesTotal > 0 ? Math.round((otherCount / routesTotal) * 100) : 0,
      isOther: true,
    });
  }

  // 8. Quy trình "Từ nhận hàng đến giao" + 3 số "Đơn đang kẹt ở đâu"
  const statusMap = new Map<string, number>();
  for (const r of funnelRows as { status_key: string; order_count: number | string }[]) {
    statusMap.set(r.status_key, Number(r.order_count ?? 0));
  }
  const cntReceived = (statusMap.get("received") ?? 0) + (statusMap.get("imported") ?? 0);
  const cntExported = (statusMap.get("exported") ?? 0) + (statusMap.get("in_transit") ?? 0);
  const cntCustomsProc = (statusMap.get("customs_processing") ?? 0) + (statusMap.get("customs") ?? 0);
  const cntCustomsRel = statusMap.get("customs_released") ?? 0;
  const cntLastMile = statusMap.get("last_mile") ?? 0;
  const cntDelivered = statusMap.get("delivered") ?? 0;
  const cntReturned = statusMap.get("returned") ?? 0;

  const funnelTotal =
    cntReceived + cntExported + cntCustomsProc + cntCustomsRel + cntLastMile + cntDelivered + cntReturned;

  const reachedExported = cntExported + cntCustomsProc + cntCustomsRel + cntLastMile + cntDelivered;
  const reachedCustomsReleased = cntCustomsRel + cntLastMile + cntDelivered;
  const reachedLastMile = cntLastMile + cntDelivered;
  const reachedDelivered = cntDelivered;

  const pctOfTotal = (n: number) => (funnelTotal > 0 ? Math.round((n / funnelTotal) * 100) : 0);

  const funnelSteps: FunnelStepItem[] = [
    { key: "received", label: "Đã nhận hàng", count: funnelTotal, pct: funnelTotal > 0 ? 100 : 0 },
    { key: "exported", label: "Đã xuất kho", count: reachedExported, pct: pctOfTotal(reachedExported) },
    {
      key: "customs_released",
      label: "Đã thông quan",
      count: reachedCustomsReleased,
      pct: pctOfTotal(reachedCustomsReleased),
    },
    { key: "last_mile", label: "Đang giao", count: reachedLastMile, pct: pctOfTotal(reachedLastMile) },
    { key: "delivered", label: "Đã giao", count: reachedDelivered, pct: pctOfTotal(reachedDelivered) },
  ];

  return {
    range,
    rangeLabel: rangeBounds.label,
    rangeShortLabel: rangeBounds.shortLabel,
    todayVn,
    todayDisplayShort: formatYmdShort(todayVn),
    todayDisplayFull: formatYmdFull(todayVn),
    lastSyncAt,
    today: {
      delivered: {
        count: deliveredTodayItems.length,
        items: deliveredTodayItems.slice(0, 4),
        allItems: deliveredTodayItems,
      },
      upcoming: {
        count: upcomingItems.length,
        items: upcomingItems.slice(0, 4),
        allItems: upcomingItems,
      },
      attention: {
        ...attention,
        items: attention.items.slice(0, 4),
        allItems: attention.items,
      },
    },
    kpis: {
      thisMonthOrders,
      lastMonthOrders,
      monthDeltaPct,
      monthLabel: monthBounds.monthLabel,
      inTransitOrders,
      inTransitLastMile,
      inTransitCustoms,
      attentionCount: kpiAttention.count,
      attentionCustoms: kpiAttention.customsStuckCount,
      attentionStale: kpiAttention.staleCount,
      attentionFailed: kpiAttention.failedOrReturnedCount,
    },
    weekly,
    monthly: await (async () => {
      const [mrows] = await monthlyRowsP;
      const counts = new Map((mrows as { ym: string; n: number | string }[]).map((r) => [r.ym, Number(r.n)]));
      return monthKeys.slice(1).map((ym, i) => {
        const count = counts.get(ym) ?? 0;
        const prev = counts.get(monthKeys[i]) ?? 0;
        const [y, m] = ym.split("-").map(Number);
        return {
          ym,
          label: `${String(m).padStart(2, "0")}/${String(y).slice(2)}`,
          count,
          deltaPct: prev > 0 ? Math.round(((count - prev) / prev) * 100) : null,
          isSelected: ym === monthlyEnd,
        };
      });
    })(),
    selectedMonth,
    weeklyLabel: selectedMonth
      ? `${rangeBounds.label} · ${weekStarts.length} tuần (tính đủ 7 ngày mỗi tuần) · Đơn / tuần`
      : "11 tuần gần nhất · Đơn / tuần",
    routes: {
      total: routesTotal,
      items: routeItems,
    },
    funnel: {
      total: funnelTotal,
      steps: funnelSteps,
      bottlenecks: {
        waitingExport: cntReceived,
        inCustoms: cntCustomsProc,
        lastMile: cntLastMile,
        inFlight: cntExported,
        customsReleased: cntCustomsRel,
        returned: cntReturned,
      },
    },
  };
}
