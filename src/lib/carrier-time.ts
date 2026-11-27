import type { ParsedVnTime } from "./dashboard";

/**
 * Giờ sự kiện của hãng chặng cuối (DHL/DPD/GLS…) Kango trả về là GIỜ ĐỊA PHƯƠNG nước nhận,
 * không kèm múi giờ (vd Berlin "14:09" = 14:09 giờ Đức). parseTrackingEventTime đọc mọi giờ
 * như giờ VN nên mốc chặng cuối bị lệch 6–8 tiếng (đo thật 27/11/2026: Hamburg giao 14:10
 * giờ Đức bị hiểu thành 14:10 VN). Hàm ở đây quy đổi lại sang epoch đúng.
 *
 * Chỉ áp cho nước có 1 múi giờ chính. Nước nhiều múi (US, CA, AU, RU…) giữ nguyên vì không
 * biết chắc múi nào.
 */
const ISO2_TZ: Record<string, string> = {
  DE: "Europe/Berlin", UK: "Europe/London", GB: "Europe/London", IE: "Europe/Dublin",
  PL: "Europe/Warsaw", CZ: "Europe/Prague", SK: "Europe/Bratislava", AT: "Europe/Vienna",
  CH: "Europe/Zurich", FR: "Europe/Paris", BE: "Europe/Brussels", NL: "Europe/Amsterdam",
  LU: "Europe/Luxembourg", IT: "Europe/Rome", ES: "Europe/Madrid", PT: "Europe/Lisbon",
  DK: "Europe/Copenhagen", SE: "Europe/Stockholm", NO: "Europe/Oslo", FI: "Europe/Helsinki",
  HU: "Europe/Budapest", RO: "Europe/Bucharest", BG: "Europe/Sofia", GR: "Europe/Athens",
  SI: "Europe/Ljubljana", HR: "Europe/Zagreb", LT: "Europe/Vilnius", LV: "Europe/Riga",
  EE: "Europe/Tallinn", JP: "Asia/Tokyo", KR: "Asia/Seoul", TW: "Asia/Taipei",
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Độ lệch (ms) của múi giờ `tz` so với UTC tại thời điểm `epochMs`. */
function zoneOffsetMs(tz: string, epochMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epochMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

function toVnParsed(epochMs: number): ParsedVnTime {
  const iso = new Date(epochMs + VN_OFFSET_MS).toISOString();
  return { dateVn: iso.slice(0, 10), hhmm: iso.slice(11, 16), epochMs };
}

/**
 * Nhận mốc đã bị đọc như giờ VN, trả lại mốc đúng (theo giờ địa phương nước `iso2`).
 * `notAfterMs`: mốc sự kiện không thể muộn hơn lúc lấy dữ liệu — nếu quy đổi ra tương lai
 * thì nghĩa là giờ gốc vốn đã là giờ VN → giữ nguyên.
 */
export function correctCarrierLocalTime(
  parsed: ParsedVnTime | null,
  iso2: string,
  notAfterMs?: number | null
): ParsedVnTime | null {
  if (!parsed) return null;
  const tz = ISO2_TZ[iso2.toUpperCase()];
  if (!tz) return parsed;
  // Giờ "đồng hồ" gốc dưới dạng UTC giả rồi trừ độ lệch múi địa phương (tính 2 lần để đúng quanh lúc đổi giờ mùa hè).
  const wallAsUtc = parsed.epochMs + VN_OFFSET_MS;
  let epoch = wallAsUtc - zoneOffsetMs(tz, wallAsUtc);
  epoch = wallAsUtc - zoneOffsetMs(tz, epoch);
  const limit = (notAfterMs && notAfterMs > 0 ? notAfterMs : Date.now()) + 10 * 60 * 1000;
  if (epoch > limit) return parsed;
  return toVnParsed(epoch);
}
