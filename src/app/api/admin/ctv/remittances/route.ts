import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findOrderById, insertCtvRemittance, updateOrder } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { orderId, note } = await request.json();
  const orderIdNum = Number(orderId);
  if (!Number.isInteger(orderIdNum) || orderIdNum <= 0) {
    return NextResponse.json({ error: "Thiếu đơn hàng" }, { status: 400 });
  }

  const order = await findOrderById(orderIdNum);
  if (!order || order.payment_status !== "collected_by_ctv" || !order.ctv_id) {
    return NextResponse.json({ error: "Đơn không ở trạng thái chờ nộp tiền thu hộ" }, { status: 409 });
  }

  const id = await insertCtvRemittance({
    orderId: orderIdNum,
    ctvId: order.ctv_id,
    amount: Number(order.amount ?? 0),
    note: typeof note === "string" && note.trim() ? note.trim() : null,
    remittedTo: session.email,
  });

  // Đã xác nhận CTV nộp lại tiền — đơn coi như đã thu xong.
  await updateOrder(orderIdNum, { paymentStatus: "paid" });

  return NextResponse.json({ ok: true, id });
}
