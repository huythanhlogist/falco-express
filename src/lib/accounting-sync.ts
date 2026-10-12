import type { OrderRecord } from "./db";
import { statusLabel } from "./payment-status";
import { upsertAccountingRow, type AccountingRow } from "./sheets";
import { formatDateVN } from "./vn-date";

export function toAccountingRow(order: OrderRecord): AccountingRow {
  return {
    falcoCode: order.falco_code,
    awb: order.awb,
    recipientName: order.recipient_name ?? "",
    destination: order.destination ?? "",
    receivedDate: formatDateVN(order.received_date),
    paymentStatusLabel: statusLabel(order.payment_status),
    collectedDate: formatDateVN(order.collected_date),
    amount: Number(order.amount ?? 0),
    cost: Number(order.cost ?? 0),
  };
}

/** Đồng bộ 1 đơn sang tab "Kế toán" trên Google Sheet (ném lỗi nếu Sheet lỗi). */
export async function syncAccountingRow(order: OrderRecord): Promise<void> {
  await upsertAccountingRow(toAccountingRow(order));
}
