import { NextResponse } from "next/server";
import { deleteExpense, updateExpense } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isInteger(expenseId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const { description, amount, expenseDate } = await request.json();
  const ok = await updateExpense(expenseId, {
    description: description !== undefined ? String(description).trim() : undefined,
    amount: amount !== undefined ? Number(amount) : undefined,
    expenseDate: expenseDate !== undefined ? String(expenseDate).replace("T", " ") : undefined,
  });

  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy chi phí" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isInteger(expenseId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const ok = await deleteExpense(expenseId);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy chi phí" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
