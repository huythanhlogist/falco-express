import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { insertDbnQuote, listDbnQuotes, type DbnRow } from "@/lib/db";

export async function GET() {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const quotes = await listDbnQuotes();
  return NextResponse.json({ quotes });
}

function isValidRow(r: unknown): r is DbnRow {
  if (!r || typeof r !== "object") return false;
  const row = r as Record<string, unknown>;
  return typeof row.label === "string" && row.label.trim().length > 0;
}

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await request.json();
  const { customerName, customerPhone, customerEmail, quoteDate, rows } = body ?? {};

  if (typeof customerName !== "string" || !customerName.trim()) {
    return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });
  }
  if (typeof quoteDate !== "string" || !quoteDate.trim()) {
    return NextResponse.json({ error: "Thiếu ngày báo giá" }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0 || !rows.every(isValidRow)) {
    return NextResponse.json({ error: "Cần ít nhất 1 dòng đơn hàng hợp lệ" }, { status: 400 });
  }

  const normalizedRows: DbnRow[] = rows.map((r) => ({
    orderId: Number.isFinite(Number(r.orderId)) ? Number(r.orderId) : null,
    label: String(r.label).trim(),
    diaChi: typeof r.diaChi === "string" ? r.diaChi.trim() : "",
    kichThuoc: typeof r.kichThuoc === "string" ? r.kichThuoc.trim() : "",
    dimKg: Number.isFinite(Number(r.dimKg)) ? Number(r.dimKg) : null,
    canThucKg: Number.isFinite(Number(r.canThucKg)) ? Number(r.canThucKg) : null,
    donGiaPerKg: Number.isFinite(Number(r.donGiaPerKg)) ? Number(r.donGiaPerKg) : null,
    phuPhi: Number.isFinite(Number(r.phuPhi)) ? Number(r.phuPhi) : 0,
    thanhTien: Number.isFinite(Number(r.thanhTien)) ? Number(r.thanhTien) : 0,
    ghiChu: typeof r.ghiChu === "string" ? r.ghiChu.trim() : "",
  }));
  const totalAmount = normalizedRows.reduce((sum, r) => sum + r.thanhTien, 0);

  const id = await insertDbnQuote({
    customerName: customerName.trim(),
    customerPhone: typeof customerPhone === "string" && customerPhone.trim() ? customerPhone.trim() : null,
    customerEmail: typeof customerEmail === "string" && customerEmail.trim() ? customerEmail.trim() : null,
    quoteDate: quoteDate.trim(),
    rows: normalizedRows,
    totalAmount,
    createdBy: session.email,
  });

  return NextResponse.json({ ok: true, id, dbnCode: String(id).padStart(4, "0") });
}
