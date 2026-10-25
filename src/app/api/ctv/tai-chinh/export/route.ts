import { NextResponse } from "next/server";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { getCtvFinance } from "@/lib/ctv-portal";
import { statusLabel } from "@/lib/payment-status";

// Sao kê tháng dạng CSV (mở được bằng Excel; thêm BOM UTF-8 để giữ dấu tiếng Việt).
export async function GET(request: Request) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const f = await getCtvFinance(session.ctvId, new URL(request.url).searchParams.get("month") ?? "");
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const d = (v: string | null) => (v ? new Date(v).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "");
  const rows = [
    ["Ngày", "Mã đơn", "Người nhận", "Điểm đến", "Cân (kg)", "Tiền thu", "Thanh toán", "Ngày thu"],
    ...f.statement.map((r) => [d(r.received_date), r.falco_code, r.recipient_name, r.destination, r.weight_kg, r.amount, statusLabel(r.payment_status), d(r.collected_date)]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sao-ke-${f.month}.csv"` },
  });
}
