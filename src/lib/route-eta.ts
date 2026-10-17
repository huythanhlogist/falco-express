import { listDeliveredOrdersForEta } from "./db";
import type { KangoTrackingResponse } from "./kango";
import { deliveredTimeOf } from "./shipment-status";

/**
 * Thời gian giao THỰC TẾ theo tuyến, tính từ chính các đơn Falco đã giao —
 * không phải con số cam kết. Đo từ ngày Falco nhận hàng (orders.received_date)
 * tới sự kiện giao thành công trong hành trình Kango. Chỉ công bố khi đủ mẫu
 * (MIN_SAMPLE đơn) để không hiện con số dựa trên 1-2 đơn lẻ.
 */

export type RouteEta = {
  /** Khoảng thường gặp (phân vị 25–75), đơn vị ngày, đã làm tròn. */
  fromDays: number;
  toDays: number;
  medianDays: number;
  sample: number;
};

export const MIN_SAMPLE = 8;
const CACHE_MS = 6 * 60 * 60 * 1000;

// Tên nước có thể đến từ Kango (tiếng Anh) hoặc nhân viên nhập tay (tiếng Việt).
const COUNTRY_ALIASES: Record<string, string[]> = {
  anh: ["UNITED KINGDOM", "UK", "GB", "GREAT BRITAIN", "ENGLAND", "ANH", "VUONG QUOC ANH"],
  duc: ["GERMANY", "DE", "DEUTSCHLAND", "DUC"],
  phap: ["FRANCE", "FR", "PHAP"],
  "ha-lan": ["NETHERLANDS", "THE NETHERLANDS", "NL", "HOLLAND", "HA LAN"],
  sec: ["CZECH REPUBLIC", "CZECHIA", "CZ", "SEC", "CH SEC", "CONG HOA SEC"],
  "ba-lan": ["POLAND", "PL", "BA LAN"],
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d");
}

/** Quy tên nước về slug tuyến của web (duc, anh, ...); nước khác giữ dạng viết hoa không dấu. */
export function routeKeyOf(country: string | null | undefined): string {
  const norm = stripAccents(country ?? "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!norm) return "";
  for (const [slug, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.includes(norm)) return slug;
  }
  return norm;
}

/** Đọc thời gian Kango: "2026-10-12 14:33:00", "2026-10-12T14:33", "12/10/2026 14:33", "12-10-2026". */
export function parseKangoTime(value: string): Date | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  m = v.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  return null;
}

function toDate(value: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return parseKangoTime(value);
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeRouteEtas(
  rows: { destination: string | null; received_date: string | Date | null; payload: string | null }[]
): Record<string, RouteEta> {
  const byRoute = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.payload) continue;
    let kango: KangoTrackingResponse;
    try {
      kango = JSON.parse(row.payload) as KangoTrackingResponse;
    } catch {
      continue;
    }
    const received = toDate(row.received_date);
    const deliveredRaw = deliveredTimeOf(kango);
    const delivered = deliveredRaw ? parseKangoTime(deliveredRaw) : null;
    if (!received || !delivered) continue;
    const days = (delivered.getTime() - received.getTime()) / 86_400_000;
    if (days < 1 || days > 60) continue; // loại dữ liệu lỗi (ngày nhập sai, đơn treo bất thường)
    const key = routeKeyOf(kango.additional_notes?.country || row.destination);
    if (!key) continue;
    byRoute.set(key, [...(byRoute.get(key) ?? []), days]);
  }

  const result: Record<string, RouteEta> = {};
  for (const [key, list] of byRoute) {
    if (list.length < MIN_SAMPLE) continue;
    const sorted = [...list].sort((a, b) => a - b);
    const fromDays = Math.max(1, Math.floor(percentile(sorted, 0.25)));
    const toDays = Math.max(fromDays + 1, Math.ceil(percentile(sorted, 0.75)));
    result[key] = { fromDays, toDays, medianDays: Math.round(percentile(sorted, 0.5)), sample: list.length };
  }
  return result;
}

let cache: { at: number; data: Record<string, RouteEta> } | null = null;

/** Thời gian giao theo tuyến (cache 6 giờ). Lỗi DB → trả rỗng để trang vẫn hiển thị bình thường. */
export async function getRouteEtas(): Promise<Record<string, RouteEta>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const data = computeRouteEtas(await listDeliveredOrdersForEta());
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.error("[route-eta] Không tính được thời gian giao theo tuyến:", err);
    return cache?.data ?? {};
  }
}
