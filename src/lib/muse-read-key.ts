import { timingSafeEqual } from "node:crypto";

/** Key CHỈ ĐỌC của trợ lý hỏi đáp Zalo (MUSE_READ_API_KEY, header x-muse-read-key). Chỉ dùng cho GET. */
export function hasMuseReadKey(request: Request): boolean {
  if (request.method !== "GET") return false;
  const key = request.headers.get("x-muse-read-key");
  const expected = process.env.MUSE_READ_API_KEY;
  if (!key || !expected) return false;
  const a = Buffer.from(key, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
