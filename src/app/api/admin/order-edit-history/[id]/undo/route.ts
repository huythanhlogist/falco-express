import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import {
  findOrderEditHistoryById,
  markOrderEditHistoryUndone,
  findOrderById,
  insertOrder,
  insertParcels,
  updateOrder,
  replaceOrderParcels,
  type OrderRecord,
} from "@/lib/db";
import { upsertAccountingRow } from "@/lib/sheets";
import { statusLabel } from "@/lib/payment-status";

type BeforeData = { order: OrderRecord; trackingCodes: string[] };

/**
 * `order.received_date` sau khi qua JSON.stringify/parse (snapshot lưu
 * trong before_data) trở thành chuỗi ISO có giờ theo UTC (vd
 * "2026-08-31T17:00:00.000Z" cho ngày 1/9 giờ VN) — KHÔNG được cắt 10 ký
 * tự đầu trực tiếp (sẽ ra "2026-08-31", lùi mất 1 ngày ở UTC+7, đúng lỗi
 * đã từng gặp và sửa ở OrderRowActions.toDateInputValue). Phải dựng lại
 * Date rồi lấy đúng thành phần ngày/tháng/năm theo giờ local.
 */
function toIsoDateLocal(value: string | Date | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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

  const entry = await findOrderEditHistoryById(historyId);
  if (!entry) {
    return NextResponse.json({ error: "Không tìm thấy lịch sử chỉnh sửa" }, { status: 404 });
  }
  if (entry.undone_at) {
    return NextResponse.json({ error: "Lượt sửa này đã được hoàn tác trước đó" }, { status: 400 });
  }

  const before = JSON.parse(entry.before_data) as BeforeData;
  const o = before.order;

  try {
    let restoredOrderId: number;

    if (entry.action === "update") {
      const stillExists = await findOrderById(entry.order_id);
      if (!stillExists) {
        return NextResponse.json(
          { error: "Đơn này đã bị xoá sau lần sửa — không thể hoàn tác qua đây, hãy hoàn tác lượt xoá thay vào đó" },
          { status: 409 }
        );
      }
      await updateOrder(entry.order_id, {
        awb: o.awb,
        recipientName: o.recipient_name ?? "",
        recipientPhone: o.recipient_phone ?? "",
        service: o.service ?? "",
        destination: o.destination ?? "",
        receivedDate: toIsoDateLocal(o.received_date),
        paymentStatus: o.payment_status,
        amount: o.amount === null ? null : Number(o.amount),
        cost: o.cost === null ? null : Number(o.cost),
      });
      await replaceOrderParcels(entry.order_id, before.trackingCodes);
      restoredOrderId = entry.order_id;
    } else {
      // action === "delete": tạo lại đơn với đúng dữ liệu cũ. AUTO_INCREMENT
      // id mới sẽ khác id cũ (id cũ có thể đã bị dùng lại) — chấp nhận được
      // vì mọi nơi tham chiếu đơn đều qua falco_code/awb, không qua id thô.
      restoredOrderId = await insertOrder({
        falcoCode: o.falco_code,
        awb: o.awb,
        recipientName: o.recipient_name ?? "",
        recipientPhone: o.recipient_phone ?? "",
        service: o.service ?? "",
        destination: o.destination ?? "",
        receivedDate: toIsoDateLocal(o.received_date),
      });
      await updateOrder(restoredOrderId, {
        paymentStatus: o.payment_status,
        amount: o.amount === null ? null : Number(o.amount),
        cost: o.cost === null ? null : Number(o.cost),
      });
      if (before.trackingCodes.length > 0) {
        await insertParcels(
          restoredOrderId,
          before.trackingCodes.map((code) => ({ hawb: "", trackingCode: code }))
        );
      }
    }

    await markOrderEditHistoryUndone(historyId);

    try {
      const restored = await findOrderById(restoredOrderId);
      if (restored) {
        await upsertAccountingRow({
          falcoCode: restored.falco_code,
          awb: restored.awb,
          recipientName: restored.recipient_name ?? "",
          destination: restored.destination ?? "",
          receivedDate: restored.received_date
            ? new Date(restored.received_date).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
            : "",
          paymentStatusLabel: statusLabel(restored.payment_status),
          amount: Number(restored.amount ?? 0),
          cost: Number(restored.cost ?? 0),
        });
      }
    } catch {
      // Không chặn hoàn tác vì lỗi đồng bộ Sheet — DB đã đúng là quan trọng nhất.
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Hoàn tác thất bại: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
