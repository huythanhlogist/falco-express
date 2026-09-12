import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { deleteDbnQuote, updateDbnQuoteImage } from "@/lib/db";

// Nhận ảnh PNG do client render (html-to-image) rồi lưu vào bản ghi DBN đã
// tạo trước đó — tách riêng bước này để không phải gửi cả blob ảnh trong
// request tạo DBN ban đầu (ảnh chỉ render được ở phía client sau khi có id).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Ảnh trống" }, { status: 400 });
  }

  await updateDbnQuoteImage(Number(id), buffer);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteDbnQuote(Number(id));
  if (!ok) return NextResponse.json({ error: "Không tìm thấy DBN" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
