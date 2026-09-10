import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { deleteCtvUser, updateCtvUser } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const ok = await updateCtvUser(Number(id), {
    fullName: typeof body.fullName === "string" ? body.fullName.trim() : undefined,
    phone: typeof body.phone === "string" ? body.phone.trim() : undefined,
    cccdNumber: typeof body.cccdNumber === "string" ? body.cccdNumber.trim() : undefined,
    status: body.status === "active" || body.status === "disabled" ? body.status : undefined,
    commissionPct: Number.isFinite(body.commissionPct) ? Number(body.commissionPct) : undefined,
    referralOverridePct: Number.isFinite(body.referralOverridePct) ? Number(body.referralOverridePct) : undefined,
  });

  if (!ok) return NextResponse.json({ error: "Không tìm thấy CTV" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteCtvUser(Number(id));
  if (!ok) return NextResponse.json({ error: "Không tìm thấy CTV" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
