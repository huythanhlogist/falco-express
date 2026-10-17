/**
 * Bảo vệ thông tin người nhận trên trang tra cứu vận đơn công khai.
 *
 * Mã Falco có dạng FL + yymmdd + số thứ tự (vd FL261012004) nên rất dễ đoán:
 * ai thử vài mã liền nhau cũng tra được đơn của người khác. Vì vậy trang tra
 * cứu chỉ trả tên người nhận ĐÃ CHE; muốn xem đầy đủ phải nhập đúng mã bưu
 * chính (postcode) của người nhận — thông tin chỉ người gửi/người nhận thật biết.
 */

/** "Nguyễn Văn Hùng" → "N***** V** H***" — giữ chữ cái đầu mỗi từ để khách vẫn nhận ra đơn của mình. */
export function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((word) => {
      const chars = Array.from(word);
      if (chars.length <= 1) return chars[0] ?? "";
      return chars[0] + "*".repeat(Math.min(chars.length - 1, 5));
    })
    .join(" ");
}

/** So khớp postcode bỏ qua hoa/thường, khoảng trắng, gạch nối ("SW1A 1AA" = "sw1a1aa", "10-001" = "10001"). */
export function normalizePostcode(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function postcodeMatches(input: string, candidates: (string | null | undefined)[]): boolean {
  const needle = normalizePostcode(input);
  if (needle.length < 3) return false;
  return candidates.some((c) => normalizePostcode(c) === needle);
}

/**
 * Giới hạn số lần nhập SAI postcode: tối đa 5 lần / 15 phút cho mỗi cặp
 * (IP, mã vận đơn) và 20 lần / 15 phút cho mỗi IP — đủ cho khách gõ nhầm vài
 * lần, nhưng chặn việc dò postcode hàng loạt. Bộ đếm nằm trong bộ nhớ tiến
 * trình Node (web chạy 1 tiến trình trên Hostinger) — khởi động lại app thì
 * bộ đếm về 0, chấp nhận được với mục đích chống dò thủ công.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_CODE = 5;
const MAX_FAILS_PER_IP = 20;
const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

export function isVerifyBlocked(ip: string, code: string, now = Date.now()): boolean {
  return (
    recent(`c:${ip}:${code}`, now).length >= MAX_FAILS_PER_CODE ||
    recent(`i:${ip}`, now).length >= MAX_FAILS_PER_IP
  );
}

export function recordVerifyFailure(ip: string, code: string, now = Date.now()): void {
  for (const key of [`c:${ip}:${code}`, `i:${ip}`]) {
    failures.set(key, [...recent(key, now), now]);
  }
  // Dọn bớt khi map phình to (nhiều IP khác nhau) để không rò bộ nhớ.
  if (failures.size > 5000) {
    for (const key of failures.keys()) recent(key, now);
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
