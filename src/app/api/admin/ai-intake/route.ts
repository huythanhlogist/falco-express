import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { insertAiIntakeOrder, listPendingAiIntakeOrders } from "@/lib/db";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB/ảnh — đủ cho ảnh chụp từ điện thoại
const MAX_IMAGES = 20;

export async function GET() {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const orders = await listPendingAiIntakeOrders();
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const form = await request.formData();
  const note = String(form.get("note") ?? "").trim();
  const files = form.getAll("images").filter((f): f is File => f instanceof File);

  if (!note && files.length === 0) {
    return NextResponse.json({ error: "Cần ít nhất ghi chú hoặc 1 ảnh" }, { status: 400 });
  }
  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Tối đa ${MAX_IMAGES} ảnh mỗi đơn` }, { status: 400 });
  }
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `Ảnh "${file.name}" vượt quá 15MB` }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `"${file.name}" không phải file ảnh` }, { status: 400 });
    }
  }

  const images = await Promise.all(
    files.map(async (file) => ({
      filename: file.name || "anh.jpg",
      mimeType: file.type || "image/jpeg",
      buffer: Buffer.from(await file.arrayBuffer()),
    }))
  );
  const id = await insertAiIntakeOrder(note, images, session.email);

  return NextResponse.json({ ok: true, id });
}
