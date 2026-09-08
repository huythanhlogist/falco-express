import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import {
  findUploadHistoryById,
  markUploadHistoryUndone,
  deleteOrder,
  updateOrder,
  replaceOrderParcels,
  findOrderById,
} from "@/lib/db";
import { removeOrderRowsByFalcoCodes } from "@/lib/sheets";
import type { UploadSnapshot } from "@/lib/kango-import";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await params;
  const historyId = Number(id);
  if (!Number.isInteger(historyId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const entry = await findUploadHistoryById(historyId);
  if (!entry) {
    return NextResponse.json({ error: "Không tìm thấy lượt upload này" }, { status: 404 });
  }
  if (entry.undone_at) {
    return NextResponse.json({ error: "Lượt upload này đã được hoàn tác trước đó" }, { status: 400 });
  }
  if (!entry.snapshot) {
    return NextResponse.json(
      { error: "Lượt upload này không có dữ liệu để hoàn tác (upload trước khi tính năng này ra mắt)" },
      { status: 400 }
    );
  }

  const snapshot = JSON.parse(entry.snapshot) as UploadSnapshot;
  const errors: string[] = [];

  // Trả lại các đơn ĐÃ SỬA về đúng nguyên trạng trước lượt upload này.
  for (const u of snapshot.updatedOrders) {
    try {
      const stillExists = await findOrderById(u.orderId);
      if (!stillExists) continue; // đơn đã bị xoá sau đó qua đường khác — bỏ qua, không phải lỗi của lượt upload này
      await updateOrder(u.orderId, {
        recipientName: u.recipientName ?? "",
        recipientPhone: u.recipientPhone ?? "",
        service: u.service ?? "",
        destination: u.destination ?? "",
        receivedDate: u.receivedDate,
      });
      await replaceOrderParcels(u.orderId, u.trackingCodes);
    } catch (err) {
      errors.push(`Đơn #${u.orderId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Xoá các đơn MỚI mà lượt upload này đã tạo ra.
  for (const ins of snapshot.insertedOrders) {
    try {
      await deleteOrder(ins.orderId);
    } catch (err) {
      errors.push(`Đơn ${ins.falcoCode}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Gỡ các dòng mirror tương ứng khỏi Google Sheet.
  try {
    await removeOrderRowsByFalcoCodes(snapshot.insertedOrders.map((o) => o.falcoCode));
  } catch (err) {
    errors.push(
      `Gỡ mirror trên Google Sheet thất bại (dữ liệu MySQL đã hoàn tác đúng): ${err instanceof Error ? err.message : String(err)}`
    );
  }

  await markUploadHistoryUndone(historyId);

  return NextResponse.json({ ok: true, errors });
}
