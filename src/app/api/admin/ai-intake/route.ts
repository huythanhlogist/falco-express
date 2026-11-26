import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { insertAiIntakeOrder, listPendingAiIntakeOrders } from "@/lib/db";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB/ảnh — đủ cho ảnh chụp chất lượng cao từ điện thoại
const MAX_TOTAL_BYTES = 60 * 1024 * 1024; // 60MB tổng/đơn — tránh tràn RAM & timeout DB
const MAX_IMAGES = 20;

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".gif": "image/gif",
};

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  if (!key || !expected) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Chỉ cho phép ảnh raster hợp lệ (jpeg/png/webp/heic/heif/gif), chặn tuyệt đối SVG và MIME lạ. */
function resolveSafeImageMime(file: File): string | null {
  const nameLower = (file.name || "").toLowerCase();
  if (nameLower.endsWith(".svg") || nameLower.endsWith(".svgz")) return null;

  const rawMime = (file.type || "").toLowerCase().trim();
  if (rawMime) {
    if (!ALLOWED_IMAGE_MIMES.has(rawMime)) return null;
    return rawMime === "image/jpg" ? "image/jpeg" : rawMime;
  }

  // Một số trình duyệt/iOS gửi file.type rỗng cho file .heic — đối chiếu theo đuôi file an toàn.
  const dotIdx = nameLower.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const ext = nameLower.slice(dotIdx);
  return EXT_TO_MIME[ext] ?? null;
}

export async function GET(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const orders = await listPendingAiIntakeOrders();
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Dữ liệu tải lên không hợp lệ" }, { status: 400 });
  }

  const note = String(form.get("note") ?? "").trim();
  const files = form.getAll("images").filter((f): f is File => f instanceof File);

  if (!note && files.length === 0) {
    return NextResponse.json({ error: "Cần ít nhất ghi chú hoặc 1 ảnh" }, { status: 400 });
  }
  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Tối đa ${MAX_IMAGES} ảnh mỗi đơn` }, { status: 400 });
  }

  let totalBytes = 0;
  const resolvedMimes: string[] = [];
  for (const file of files) {
    if (file.size <= 0) {
      return NextResponse.json({ error: `Ảnh "${file.name}" bị rỗng` }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `Ảnh "${file.name}" vượt quá 20MB` }, { status: 400 });
    }
    const safeMime = resolveSafeImageMime(file);
    if (!safeMime) {
      return NextResponse.json(
        { error: `"${file.name}" không phải định dạng ảnh được hỗ trợ (chỉ nhận JPG, PNG, WebP, HEIC, GIF — không nhận SVG)` },
        { status: 400 }
      );
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "Tổng dung lượng ảnh của 1 đơn vượt quá 60MB — vui lòng tách bớt ảnh" },
        { status: 400 }
      );
    }
    resolvedMimes.push(safeMime);
  }

  const images = await Promise.all(
    files.map(async (file, idx) => ({
      filename: file.name || "anh.jpg",
      mimeType: resolvedMimes[idx],
      buffer: Buffer.from(await file.arrayBuffer()),
    }))
  );
  const id = await insertAiIntakeOrder(note, images, session.email);

  return NextResponse.json({ ok: true, id });
}
