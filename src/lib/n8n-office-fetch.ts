// Gọi webhook n8n cho trang Văn phòng AI: thử lại khi lỗi thoáng qua và giữ bản
// trả lời tốt gần nhất để trang không "mất kết nối" mỗi lần n8n chậm vài giây.
type Cached = { body: unknown; at: number };
const cache = new Map<string, Cached>();
const STALE_MAX_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const DEFAULT_ATTEMPT_TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;

function pruneCache(now: number): void {
  for (const [k, v] of cache) {
    if (now - v.at >= STALE_MAX_MS) {
      cache.delete(k);
    }
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export async function fetchOfficeWithRetry(
  url: string,
  init: RequestInit,
  cacheKey?: string,
  timeoutMs: number = DEFAULT_ATTEMPT_TIMEOUT_MS,
): Promise<{ status: number; body: unknown; stale: boolean }> {
  let lastError = "";
  const effectiveTimeout = Math.max(2000, Math.min(timeoutMs, 25_000));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(effectiveTimeout),
      });
      if (res.status === 401 || res.status === 403) {
        return { status: res.status, body: null, stale: false };
      }
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
        if (cacheKey && res.ok) {
          const now = Date.now();
          pruneCache(now);
          cache.delete(cacheKey);
          cache.set(cacheKey, { body, at: now });
        }
        return { status: res.status, body, stale: false };
      }
    } catch {
      lastError = "Không kết nối được n8n";
    }
    // Chỉ chờ giữa các lần thử, không ngủ thừa ở lần thử cuối.
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }

  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit) {
      if (Date.now() - hit.at < STALE_MAX_MS && hit.body && typeof hit.body === "object") {
        return {
          status: 200,
          body: {
            ...(hit.body as object),
            stale: true,
            staleSince: new Date(hit.at).toISOString(),
          },
          stale: true,
        };
      }
      cache.delete(cacheKey);
    }
  }

  return { status: 502, body: { ok: false, error: lastError || "Không kết nối được n8n" }, stale: false };
}
