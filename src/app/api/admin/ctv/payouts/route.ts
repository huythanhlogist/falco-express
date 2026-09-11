import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { getCtvCommissionSummary, insertCtvPayout } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { ctvId, amount, note } = await request.json();
  const ctvIdNum = Number(ctvId);
  const amountNum = Number(amount);
  if (!Number.isInteger(ctvIdNum) || ctvIdNum <= 0) {
    return NextResponse.json({ error: "Thiếu CTV" }, { status: 400 });
  }
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "Số tiền không hợp lệ" }, { status: 400 });
  }

  const id = await insertCtvPayout({
    ctvId: ctvIdNum,
    amount: amountNum,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
    paidBy: session.email,
  });

  const summary = await getCtvCommissionSummary(ctvIdNum);
  return NextResponse.json({ ok: true, id, summary });
}
