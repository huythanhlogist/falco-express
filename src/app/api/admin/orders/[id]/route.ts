import { NextResponse } from "next/server";
import { updatePaymentStatus } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const { paymentStatus } = await request.json();
  if (paymentStatus !== "paid" && paymentStatus !== "unpaid") {
    return NextResponse.json(
      { error: "Trạng thái thanh toán không hợp lệ" },
      { status: 400 }
    );
  }

  const ok = await updatePaymentStatus(orderId, paymentStatus);
  if (!ok) {
    return NextResponse.json(
      { error: "Không tìm thấy đơn hàng" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
