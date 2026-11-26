// Ngày (YYYY-MM-DD) theo giờ Việt Nam, lùi `daysAgo` ngày — không phụ thuộc
// múi giờ của tiến trình Node hay đồng hồ MySQL (đồng hồ server DB Hostinger
// lệch ~7h so với giờ thật nên không dùng CURDATE()/NOW() cho việc này).
export function vnDateString(daysAgo = 0): string {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  vnNow.setUTCDate(vnNow.getUTCDate() - daysAgo);
  return vnNow.toISOString().slice(0, 10);
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Kiểm tra chuỗi ngày YYYY-MM-DD có phải ngày lịch hợp lệ không (chặn 2026-02-31, 2026-13-01...). */
export function isValidIsoDate(value: string): boolean {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Chuẩn hoá giá trị DATE (chuỗi "YYYY-MM-DD", ISO timestamp UTC từ snapshot
 * JSON, hoặc Date object) sang chuỗi "YYYY-MM-DD" theo giờ Việt Nam (UTC+7),
 * không phụ thuộc múi giờ máy chủ Node hay trình duyệt.
 */
export function toIsoDateLocal(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return isValidIsoDate(trimmed) ? trimmed : null;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const vn = new Date(d.getTime() + VN_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}`;
}

/** Định dạng giá trị DATE sang "DD/MM/YYYY" theo giờ Việt Nam (UTC+7). */
export function formatDateVN(value: string | Date | null): string {
  const iso = toIsoDateLocal(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
