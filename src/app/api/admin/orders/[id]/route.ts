import { NextResponse } from "next/server";
import {
  deleteOrder,
  findOrderById,
  listOrderParcels,
  replaceOrderParcels,
  updateOrder,
  insertOrderEditHistory,
  type PaymentStatus,
} from "@/lib/db";
import { upsertAccountingRow } from "@/lib/sheets";
import { statusLabel } from "@/lib/payment-status";
import { getCurrentAdminSession } from "@/lib/auth";

function formatDateVN(value: string | Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

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

  const willChangeFields = Object.keys(fields).length > 0;
  const willChangeParcels = Array.isArray(trackingCodes);

  // Lưu lại nguyên trạng TRƯỚC khi sửa — để có thể hoàn tác nếu sửa nhầm.
  // Chỉ ghi log khi thực sự có gì đó sẽ đổi, tránh làm rác lịch sử với các
  // lần lưu không đổi gì.
  if (willChangeFields || willChangeParcels) {
    const session = await getCurrentAdminSession();
    const currentParcels = await listOrderParcels(orderId);
    await insertOrderEditHistory({
      orderId,
      action: "update",
      changedBy: session?.email ?? "unknown",
      beforeData: {
        order,
        trackingCodes: currentParcels.map((p) => p.tracking_code),
      },
    });
  }

  if (willChangeFields) {
    await updateOrder(orderId, fields);
  }

  if (willChangeParcels) {
    await replaceOrderParcels(orderId, trackingCodes.map(String));
  }

  // Đồng bộ NGAY (await trong cùng request, không phải job nền) sang tab
  // "Kế toán" trên Google Sheet mỗi khi Thu/Chi/trạng thái thu đổi — để
  // Sheet luôn khớp dữ liệu với DB, không có độ trễ. Đọc lại đơn mới nhất
  // vì có thể chỉ 1 trong 2 trường Thu/Chi được sửa ở lần PATCH này.
  let sheetSyncError: string | undefined;
  if (fields.amount !== undefined || fields.cost !== undefined || fields.paymentStatus !== undefined) {
    const fresh = await findOrderById(orderId);
    if (fresh) {
      try {
        await upsertAccountingRow({
          falcoCode: fresh.falco_code,
          awb: fresh.awb,
          recipientName: fresh.recipient_name ?? "",
          destination: fresh.destination ?? "",
          receivedDate: formatDateVN(fresh.received_date),
          paymentStatusLabel: statusLabel(fresh.payment_status),
          amount: Number(fresh.amount ?? 0),
          cost: Number(fresh.cost ?? 0),
        });
      } catch (err) {
        // Sheet chỉ là bản mirror để xem — DB vẫn là nguồn thật đã lưu
        // đúng, không chặn phản hồi thành công vì lỗi đồng bộ Sheet.
        sheetSyncError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  return NextResponse.json({ ok: true, ...(sheetSyncError ? { sheetSyncError } : {}) });
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

  const order = await findOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }

  const session = await getCurrentAdminSession();
  const parcels = await listOrderParcels(orderId);
  await insertOrderEditHistory({
    orderId,
    action: "delete",
    changedBy: session?.email ?? "unknown",
    beforeData: { order, trackingCodes: parcels.map((p) => p.tracking_code) },
  });

  const ok = await deleteOrder(orderId);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
