// Giới hạn số lần đăng nhập sai trong bộ nhớ theo cặp IP + email (5 lần sai / 15 phút).

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const MAX_BUCKETS = 2000;
const attemptsMap = new Map<string, number[]>();

function pruneMap(now: number, windowMs: number): void {
  if (attemptsMap.size < MAX_BUCKETS) return;
  for (const [k, timestamps] of attemptsMap) {
    const active = timestamps.filter((ts) => now - ts < windowMs);
    if (active.length === 0) attemptsMap.delete(k);
    else attemptsMap.set(k, active);
  }
  while (attemptsMap.size >= MAX_BUCKETS) {
    const oldest = attemptsMap.keys().next().value;
    if (oldest === undefined) break;
    attemptsMap.delete(oldest);
  }
}

function getActiveTimestamps(key: string, now: number, windowMs: number): number[] {
  const raw = attemptsMap.get(key);
  if (!raw || raw.length === 0) return [];
  const active = raw.filter((ts) => now - ts < windowMs);
  if (active.length === 0) attemptsMap.delete(key);
  else if (active.length !== raw.length) attemptsMap.set(key, active);
  return active;
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  return "unknown";
}

export function makeLoginRateLimitKey(request: Request, email: string): string {
  const ip = getClientIp(request);
  const normalizedEmail = email.trim().toLowerCase();
  return `${ip}|${normalizedEmail}`;
}

export function checkLoginRateLimit(
  key: string,
  maxAttempts: number = LOGIN_MAX_ATTEMPTS,
  windowMs: number = LOGIN_WINDOW_MS
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const active = getActiveTimestamps(key, now, windowMs);
  if (active.length >= maxAttempts) {
    const oldest = active[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - active.length),
    retryAfterSeconds: 0,
  };
}

export function recordLoginFailure(
  key: string,
  maxAttempts: number = LOGIN_MAX_ATTEMPTS,
  windowMs: number = LOGIN_WINDOW_MS
): { blocked: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  pruneMap(now, windowMs);
  const active = getActiveTimestamps(key, now, windowMs);
  active.push(now);
  attemptsMap.set(key, active);

  if (active.length >= maxAttempts) {
    const oldest = active[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { blocked: true, remaining: 0, retryAfterSeconds };
  }
  return {
    blocked: false,
    remaining: Math.max(0, maxAttempts - active.length),
    retryAfterSeconds: 0,
  };
}

export function clearLoginRateLimit(key: string): void {
  attemptsMap.delete(key);
}
