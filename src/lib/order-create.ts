import { insertOrder, listFalcoCodeSet, type OrderSource } from "./db";
import { nextFalcoCode } from "./kango-import";

export type CreateManualOrderInput = {
  recipientName: string;
  recipientPhone: string;
  service: string;
  destination: string;
  receivedDate: string | null;
  weightKg: number | null;
  amount: number | null;
};

/**
 * Tạo đơn thủ công (không qua upload Excel Kango) — dùng chung cho nhân
 * viên (`/admin/orders`, chưa từng có form nào trước phase này) và CTV
 * (`/ctv/tao-don`). AWB thật sự (do Kango cấp) chưa có ở bước này nên tạm
 * dùng chính mã Falco làm AWB — nhân viên sửa lại qua form sửa đơn sẵn có
 * khi có AWB thật.
 */
export async function createManualOrder(
  input: CreateManualOrderInput,
  meta: { source: OrderSource; ctvId: number | null }
): Promise<{ id: number; falcoCode: string }> {
  const existingCodes = await listFalcoCodeSet();
  const falcoCode = nextFalcoCode(existingCodes);

  const id = await insertOrder({
    falcoCode,
    awb: falcoCode,
    recipientName: input.recipientName,
    recipientPhone: input.recipientPhone,
    service: input.service,
    destination: input.destination,
    receivedDate: input.receivedDate,
    weightKg: input.weightKg,
    amount: input.amount,
    source: meta.source,
    ctvId: meta.ctvId,
    reviewStatus: meta.source === "ctv" ? "pending" : "auto_approved",
  });

  return { id, falcoCode };
}
