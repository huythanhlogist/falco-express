// Gọi webhook n8n cho trang Văn phòng AI: thử lại khi lỗi thoáng qua và giữ bản
// trả lời tốt gần nhất để trang không "mất kết nối" mỗi lần n8n chậm vài giây.
type Cached = { body: unknown; at: number };
const cache = new Map<string, Cached>();
const STALE_MAX_MS = 10 * 60 * 1000;

export async function fetchOfficeWithRetry(
  url: string,
  init: RequestInit,
  cacheKey?: string,
): Promise<{ status: number; body: unknown; stale: boolean }> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
      if (res.status === 401 || res.status === 403) return { status: res.status, body: null, stale: false };
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
      // 5xx hoặc trả về không phải JSON: coi là lỗi thoáng qua, thử lại.
      if (res.status >= 500 || body === null) {
        lastError = `n8n trả về ${res.status}`;
      } else {
        if (cacheKey && res.ok) cache.set(cacheKey, { body, at: Date.now() });
        return { status: res.status, body, stale: false };
      }
    } catch {
      lastError = "Không kết nối được n8n";
    }
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < STALE_MAX_MS && hit.body && typeof hit.body === "object") {
      return { status: 200, body: { ...(hit.body as object), stale: true, staleSince: new Date(hit.at).toISOString() }, stale: true };
    }
  }
  return { status: 502, body: { ok: false, error: lastError || "Không kết nối được n8n" }, stale: false };
}
