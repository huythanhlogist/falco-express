import { mkdir, readFile, rename, stat, unlink, writeFile } from "fs/promises";
import os from "os";
import path from "path";

// Ảnh vận đơn BayOnline nằm ở img.bayonlinevn.com/<uuid>. Host cố định + chỉ
// nhận uuid hợp lệ => route proxy không thể bị dùng để tải URL tuỳ ý (SSRF).
const BAY_IMAGE_HOST = "https://img.bayonlinevn.com";
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 8 * 1024 * 1024;

export function bayImageUuid(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.origin !== BAY_IMAGE_HOST) return null;
    const id = u.pathname.replace(/^\/+/, "");
    return UUID_RE.test(id) ? id.toLowerCase() : null;
  } catch {
    return null;
  }
}

// Mặc định nằm NGOÀI thư mục deploy (mỗi lần deploy Hostinger thay thư mục app
// sẽ làm mất file), đổi được bằng BAY_IMAGE_DIR.
export function bayImageDir(): string {
  return process.env.BAY_IMAGE_DIR || path.join(os.homedir(), "falco-bay-images");
}
const fileOf = (id: string) => path.join(bayImageDir(), id);
const metaOf = (id: string) => path.join(bayImageDir(), `${id}.type`);

export async function readSavedImage(id: string): Promise<{ data: Buffer; type: string } | null> {
  if (!UUID_RE.test(id)) return null;
  const normalized = id.toLowerCase();
  try {
    const [data, type] = await Promise.all([
      readFile(fileOf(normalized)),
      readFile(metaOf(normalized), "utf8").catch(() => "image/webp"),
    ]);
    return { data, type: type.trim() || "image/webp" };
  } catch {
    return null;
  }
}

export async function fetchBayImage(id: string): Promise<Response> {
  if (!UUID_RE.test(id)) throw new Error("Mã ảnh không hợp lệ");
  return fetch(`${BAY_IMAGE_HOST}/${id.toLowerCase()}`, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
}

/**
 * Tải ảnh từ Bay về đĩa (ghi ra file tạm rồi đổi tên nguyên tử để không để lại file hỏng nếu đứt giữa chừng).
 * Trả "saved" | "exists"; ném lỗi nếu không tải được/quá lớn.
 */
export async function saveBayImage(id: string): Promise<"saved" | "exists"> {
  if (!UUID_RE.test(id)) throw new Error("Mã ảnh không hợp lệ");
  const normalized = id.toLowerCase();
  const targetFile = fileOf(normalized);
  const targetMeta = metaOf(normalized);

  if (await stat(targetFile).then((s) => s.size > 0, () => false)) return "exists";
  const res = await fetchBayImage(normalized);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("Ảnh rỗng");
  if (buf.length > MAX_BYTES) throw new Error("Ảnh quá lớn");

  await mkdir(bayImageDir(), { recursive: true });
  const suffix = `.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const tmpFile = `${targetFile}${suffix}`;
  const tmpMeta = `${targetMeta}${suffix}`;
  try {
    await writeFile(tmpFile, buf);
    await writeFile(tmpMeta, type);
    await rename(tmpMeta, targetMeta);
    await rename(tmpFile, targetFile);
  } catch (err) {
    await Promise.all([unlink(tmpFile).catch(() => undefined), unlink(tmpMeta).catch(() => undefined)]);
    throw err;
  }
  return "saved";
}
