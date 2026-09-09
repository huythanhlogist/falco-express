import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { updatePriceQuoteLineMeta, deletePriceQuoteLine } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  await updatePriceQuoteLineMeta(Number(id), {
    title: typeof body.title === "string" ? body.title : undefined,
    countries: body.countries === null ? null : typeof body.countries === "string" ? body.countries : undefined,
    minWeightKg:
      body.minWeightKg === null
        ? null
        : typeof body.minWeightKg === "number"
          ? body.minWeightKg
          : undefined,
    markupFlatVnd: typeof body.markupFlatVnd === "number" ? body.markupFlatVnd : undefined,
    markupPerKgVnd: typeof body.markupPerKgVnd === "number" ? body.markupPerKgVnd : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await deletePriceQuoteLine(Number(id));
  if (!ok) return NextResponse.json({ error: "Không tìm thấy dòng giá" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
