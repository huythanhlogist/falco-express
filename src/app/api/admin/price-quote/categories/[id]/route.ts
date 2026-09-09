import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { updatePriceQuoteCategoryMeta, deletePriceQuoteCategory } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  await updatePriceQuoteCategoryMeta(Number(id), {
    title: typeof body.title === "string" ? body.title : undefined,
    note: body.note === null ? null : typeof body.note === "string" ? body.note : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await deletePriceQuoteCategory(Number(id));
  if (!ok) return NextResponse.json({ error: "Không tìm thấy nhóm giá" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
