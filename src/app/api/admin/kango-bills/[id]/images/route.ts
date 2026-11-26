import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import {
  findKangoBillById,
  listKangoBillImages,
  type KangoBillImageMeta,
} from "@/lib/db";
import {
  AGENT_CREATED_BY,
  insertKangoBillImagesWithLimit,
  isValidAgentKey,
} from "@/lib/kango-bill-db";
import {
  ALLOWED_KANGO_IMAGE_TYPES,
  MAX_KANGO_BILL_IMAGES,
  MAX_KANGO_IMAGE_BYTES,
  parsePositiveId,
} from "@/lib/kango-bill-validate";

function toImageDto(img: KangoBillImageMeta) {
  return {
    id: img.id,
    filename: img.filename,
    mime_type: img.mime_type,
    url: `/api/admin/kango-bills/images/${img.id}`,
  };
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
  const isAgent = !session && isValidAgentKey(request);
  if (!session && !isAgent) {
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
  if (isAgent && bill.created_by !== AGENT_CREATED_BY) {
    return NextResponse.json({ error: "Agent chỉ được tải ảnh lên bill do agent tạo" }, { status: 403 });
  }
  if ((bill.status as string) !== "draft") {
    return NextResponse.json(
      { error: "Bill đã gửi hoặc đang gửi lên Kango, không thể thêm ảnh" },
      { status: 409 }
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Dữ liệu upload không hợp lệ" }, { status: 400 });
  }
  const files = form.getAll("images").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Vui lòng chọn ít nhất 1 ảnh" }, { status: 400 });
  }

  if (files.length > MAX_KANGO_BILL_IMAGES) {
    return NextResponse.json(
      { error: `Tối đa ${MAX_KANGO_BILL_IMAGES} ảnh mỗi bill` },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (!ALLOWED_KANGO_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `"${file.name}" không đúng định dạng (chỉ chấp nhận JPEG, PNG, WebP)` },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: `Ảnh "${file.name}" không có dữ liệu` }, { status: 400 });
    }
    if (file.size > MAX_KANGO_IMAGE_BYTES) {
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

  const inserted = await insertKangoBillImagesWithLimit(billId, prepared, MAX_KANGO_BILL_IMAGES);
  if (!inserted.ok) {
    if (inserted.reason === "not_found") {
      return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
    }
    if (inserted.reason === "locked") {
      return NextResponse.json(
        { error: "Bill đã gửi hoặc đang gửi lên Kango, không thể thêm ảnh" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: `Tối đa ${MAX_KANGO_BILL_IMAGES} ảnh mỗi bill (hiện đã có ${inserted.existingCount ?? 0} ảnh)`,
      },
      { status: 400 }
    );
  }

  const updated = await listKangoBillImages(billId);
  return NextResponse.json({ images: updated.map(toImageDto) });
}
