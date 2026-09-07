import { NextResponse } from "next/server";
import { insertExpense, listExpenses } from "@/lib/db";

export async function GET() {
  const expenses = await listExpenses();
  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const { description, amount, expenseDate } = await request.json();

  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "Thiếu mô tả chi phí" }, { status: 400 });
  }
  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "Số tiền không hợp lệ" }, { status: 400 });
  }
  if (!expenseDate || typeof expenseDate !== "string") {
    return NextResponse.json({ error: "Thiếu ngày giờ" }, { status: 400 });
  }

  const id = await insertExpense({
    description: description.trim(),
    amount: amountNum,
    expenseDate: expenseDate.replace("T", " "),
  });

  return NextResponse.json({ ok: true, id });
}
