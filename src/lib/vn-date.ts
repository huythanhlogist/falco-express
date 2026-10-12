// Ngày (YYYY-MM-DD) theo giờ Việt Nam, lùi `daysAgo` ngày — không phụ thuộc
// múi giờ của tiến trình Node hay đồng hồ MySQL (đồng hồ server DB Hostinger
// lệch ~7h so với giờ thật nên không dùng CURDATE()/NOW() cho việc này).
export function vnDateString(daysAgo = 0): string {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  vnNow.setUTCDate(vnNow.getUTCDate() - daysAgo);
  return vnNow.toISOString().slice(0, 10);
}

// Cột DATE của MySQL được mysql2 trả về dạng Date lúc 00:00 giờ local của
// tiến trình — nên đọc ngày/tháng/năm bằng getter local để ra đúng ngày.
export function formatDateVN(value: string | Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Giá trị DATE sau khi qua JSON.stringify/parse (vd snapshot lịch sử sửa đơn)
 * thành chuỗi ISO giờ UTC (vd "2026-08-31T17:00:00.000Z" cho ngày 1/9 giờ
 * VN) — KHÔNG được cắt 10 ký tự đầu (sẽ lùi mất 1 ngày ở UTC+7). Dựng lại
 * Date rồi lấy thành phần ngày theo giờ local.
 */
export function toIsoDateLocal(value: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
