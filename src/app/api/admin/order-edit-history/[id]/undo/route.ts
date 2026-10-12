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
import { syncAccountingRow } from "@/lib/accounting-sync";
import { toIsoDateLocal } from "@/lib/vn-date";

type BeforeData = { order: OrderRecord; trackingCodes: string[] };

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
        collectedDate: toIsoDateLocal(o.collected_date ?? null),
        amount: o.amount === null ? null : Number(o.amount),
        cost: o.cost === null ? null : Number(o.cost),
        chiSourceInvoice: o.chi_source_invoice,
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
        collectedDate: toIsoDateLocal(o.collected_date ?? null),
        amount: o.amount === null ? null : Number(o.amount),
        cost: o.cost === null ? null : Number(o.cost),
        chiSourceInvoice: o.chi_source_invoice,
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
        await syncAccountingRow(restored);
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
