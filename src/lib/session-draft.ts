/**
 * Lưu nháp 1 form vào sessionStorage — để chuyển sang tab admin khác rồi
 * quay lại không bị mất dữ liệu đang gõ dở (mỗi tab trình duyệt có
 * sessionStorage riêng, tự xoá khi đóng tab — không phải chỗ lưu lâu dài).
 */
export function loadDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nháp chỉ là tiện ích — bỏ qua nếu sessionStorage đầy/bị chặn.
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // no-op
  }
}
