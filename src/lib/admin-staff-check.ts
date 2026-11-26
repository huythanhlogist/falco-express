import { getPool, type AdminRole } from "@/lib/db";

const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

type CacheEntry = {
  role: AdminRole | null;
  expiresAt: number;
};

const staffCache = new Map<string, CacheEntry>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function pruneExpired(now: number): void {
  if (staffCache.size < MAX_CACHE_ENTRIES) return;
  for (const [k, v] of staffCache) {
    if (v.expiresAt <= now) staffCache.delete(k);
  }
  while (staffCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = staffCache.keys().next().value;
    if (oldest === undefined) break;
    staffCache.delete(oldest);
  }
}

/**
 * Kiểm tra tài khoản quản trị còn tồn tại trong bảng admin_users hay không
 * và trả về vai trò hiện tại. Cache trong bộ nhớ 60 giây theo email để giảm tải DB.
 */
export async function getActiveAdminRole(email: string): Promise<AdminRole | null> {
  const key = normalizeEmail(email);
  if (!key) return null;

  const now = Date.now();
  const cached = staffCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.role;
  }

  const [rows] = await getPool().query(
    "SELECT role FROM admin_users WHERE email = ? LIMIT 1",
    [key]
  );
  const list = rows as { role?: string }[];
  const row = list[0];
  const role: AdminRole | null = row
    ? row.role === "owner"
      ? "owner"
      : "staff"
    : null;

  pruneExpired(now);
  staffCache.set(key, { role, expiresAt: now + CACHE_TTL_MS });
  return role;
}

/**
 * Xoá cache ngay khi tạo mới hoặc xoá tài khoản nhân viên để phiên cũ mất hiệu lực tức thì.
 */
export function invalidateAdminStaffCache(email?: string): void {
  if (!email) {
    staffCache.clear();
    return;
  }
  staffCache.delete(normalizeEmail(email));
}
