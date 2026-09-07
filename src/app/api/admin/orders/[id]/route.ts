import { NextResponse } from "next/server";
import {
  deleteOrder,
  findOrderById,
  listOrderParcels,
  replaceOrderParcels,
  updateOrder,
  type PaymentStatus,
} from "@/lib/db";

const VALID_STATUSES: PaymentStatus[] = ["unpaid", "collected_by_staff", "paid"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const order = await findOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }

  const parcels = await listOrderParcels(orderId);
  return NextResponse.json({ order, parcels });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const order = await findOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }

  const body = await request.json();
  const {
    paymentStatus,
    amount,
    cost,
    awb,
    recipientName,
    recipientPhone,
    service,
    destination,
    receivedDate,
    trackingCodes,
  } = body ?? {};

  if (paymentStatus !== undefined && !VALID_STATUSES.includes(paymentStatus)) {
    return NextResponse.json(
      { error: "Trạng thái thu tiền không hợp lệ" },
      { status: 400 }
    );
  }

  const fields: Parameters<typeof updateOrder>[1] = {};
  if (paymentStatus !== undefined) fields.paymentStatus = paymentStatus;
  if (amount !== undefined) fields.amount = amount === null || amount === "" ? null : Number(amount);
  if (cost !== undefined) fields.cost = cost === null || cost === "" ? null : Number(cost);
  if (awb !== undefined) fields.awb = String(awb).trim();
  if (recipientName !== undefined) fields.recipientName = String(recipientName).trim();
  if (recipientPhone !== undefined) fields.recipientPhone = String(recipientPhone).trim();
  if (service !== undefined) fields.service = String(service).trim();
  if (destination !== undefined) fields.destination = String(destination).trim();
  if (receivedDate !== undefined) fields.receivedDate = receivedDate || null;

  if (Object.keys(fields).length > 0) {
    await updateOrder(orderId, fields);
  }

  if (Array.isArray(trackingCodes)) {
    await replaceOrderParcels(orderId, trackingCodes.map(String));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const ok = await deleteOrder(orderId);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
