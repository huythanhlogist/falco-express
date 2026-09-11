import { NextResponse } from "next/server";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { deleteOrder, findOrderById, listOrderParcels, updateOrder } from "@/lib/db";

async function loadOwnPendingOrder(orderId: number, ctvId: number) {
  const order = await findOrderById(orderId);
  if (!order || order.ctv_id !== ctvId) return null;
  return order;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const order = await findOrderById(Number(id));
  if (!order || order.ctv_id !== session.ctvId) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }
  const parcels = await listOrderParcels(order.id);
  return NextResponse.json({ order, parcels });
}

// CTV chỉ sửa/xoá được đơn của chính mình VÀ khi đơn còn "chờ duyệt" — sau
// khi admin đã duyệt/từ chối thì chỉ xem, tránh CTV sửa đơn admin đang xử lý.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const order = await loadOwnPendingOrder(Number(id), session.ctvId);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  if (order.review_status !== "pending") {
    return NextResponse.json(
      { error: "Đơn đã được xử lý, không thể sửa nữa" },
      { status: 409 }
    );
  }

  const { recipientName, recipientPhone, service, destination, receivedDate, weightKg, amount } =
    await request.json();

  const fields: Parameters<typeof updateOrder>[1] = {};
  if (recipientName !== undefined) fields.recipientName = String(recipientName).trim();
  if (recipientPhone !== undefined) fields.recipientPhone = String(recipientPhone).trim();
  if (service !== undefined) fields.service = String(service).trim();
  if (destination !== undefined) fields.destination = String(destination).trim();
  if (receivedDate !== undefined) fields.receivedDate = receivedDate || null;
  if (weightKg !== undefined) fields.weightKg = weightKg === null || weightKg === "" ? null : Number(weightKg);
  if (amount !== undefined) fields.amount = amount === null || amount === "" ? null : Number(amount);

  await updateOrder(order.id, fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const order = await loadOwnPendingOrder(Number(id), session.ctvId);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  if (order.review_status !== "pending") {
    return NextResponse.json(
      { error: "Đơn đã được xử lý, không thể xoá nữa" },
      { status: 409 }
    );
  }

  await deleteOrder(order.id);
  return NextResponse.json({ ok: true });
}
