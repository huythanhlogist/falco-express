import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import {
  findKangoBillById,
  insertKangoBillImages,
  listKangoBillImages,
  type KangoBillImageMeta,
} from "@/lib/db";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB mỗi ảnh
const MAX_IMAGES_PER_BILL = 6;

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  return Boolean(key && expected && key === expected);
}

function toImageDto(img: KangoBillImageMeta) {
  return {
    id: img.id,
    filename: img.filename,
    mime_type: img.mime_type,
    url: `/api/admin/kango-bills/images/${img.id}`,
  };
}

function parsePositiveId(raw: string): number | null {
  const num = Number(raw);
  return Number.isInteger(num) && num > 0 ? num : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await params;
  const billId = parsePositiveId(id);
  if (!billId) {
    return NextResponse.json({ error: "ID bill không hợp lệ" }, { status: 400 });
  }

  const bill = await findKangoBillById(billId);
  if (!bill) {
    return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  }

  const rows = await listKangoBillImages(billId);
  return NextResponse.json({ images: rows.map(toImageDto) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await params;
  const billId = parsePositiveId(id);
  if (!billId) {
    return NextResponse.json({ error: "ID bill không hợp lệ" }, { status: 400 });
  }

  const bill = await findKangoBillById(billId);
  if (!bill) {
    return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  }

  const form = await request.formData();
  const files = form.getAll("images").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Vui lòng chọn ít nhất 1 ảnh" }, { status: 400 });
  }

  const existing = await listKangoBillImages(billId);
  if (existing.length + files.length > MAX_IMAGES_PER_BILL) {
    return NextResponse.json(
      { error: `Tối đa ${MAX_IMAGES_PER_BILL} ảnh mỗi bill (hiện đã có ${existing.length} ảnh)` },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `"${file.name}" không đúng định dạng (chỉ chấp nhận JPEG, PNG, WebP)` },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: `Ảnh "${file.name}" không có dữ liệu` }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `Ảnh "${file.name}" vượt quá 5 MB` }, { status: 400 });
    }
  }

  const prepared = await Promise.all(
    files.map(async (file) => ({
      filename: file.name || "kien-hang.jpg",
      mimeType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    }))
  );

  await insertKangoBillImages(billId, prepared);
  const updated = await listKangoBillImages(billId);
  return NextResponse.json({ images: updated.map(toImageDto) });
}
