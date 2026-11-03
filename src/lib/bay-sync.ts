import { fillOrderBlanks, findOrdersByAwbs, insertOrder, listTrackingCodesByOrders, insertParcels, listFalcoCodeSet, setOrderService } from "./db";
import { bay, isBayConfigured, type BayShipment } from "./bay-api";
import { BAY_COUNTRY_VI, BAY_SERVICE_NAME_VI } from "./bay-tracking";

// Mã đơn của vận đơn BayOnline trên Falco: FEB + yymmdd + số thứ tự 3 chữ số (vd FEB261025001),
// cùng kiểu mã FL của đơn Kango. Mã vận đơn Bay (vd "2410-0887") lưu ở orders.awb.
export const FEB_PREFIX = "FEB";

export function isBayOrderCode(falcoCode: string): boolean {
  return falcoCode.toUpperCase().startsWith(FEB_PREFIX);
}

function vnDateParts(iso: string): { ymd: string; yymmdd: string } {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  return { ymd: d, yymmdd: d.slice(2).replace(/-/g, "") };
}

export function nextFebCode(existing: Set<string>, dateIso: string): string {
  const prefix = `${FEB_PREFIX}${vnDateParts(dateIso).yymmdd}`;
  let seq = 1;
  let code = `${prefix}${String(seq).padStart(3, "0")}`;
  while (existing.has(code)) {
    seq += 1;
    code = `${prefix}${String(seq).padStart(3, "0")}`;
  }
  return code;
}

export type BaySyncResult = {
  total: number;
  created: { reference: string; falcoCode: string }[];
  alreadySynced: number;
};

function destinationOf(s: BayShipment): string {
  const a = s.recipient.address;
  const country = a.countryCode ? (BAY_COUNTRY_VI[a.countryCode.toUpperCase()] ?? a.countryCode) : "";
  return [a.city, country].filter(Boolean).join(", ");
}

/**
 * Đồng bộ vận đơn BayOnline → bảng orders của Falco (idempotent): mỗi vận đơn Bay có đúng 1
 * đơn Falco mã FEB…; chạy lại nhiều lần không sinh đơn trùng. Cập nhật mã tracking chặng cuối
 * khi Bay gán nhãn sau đó.
 */
// Chỉ đồng bộ vận đơn tạo trong 30 ngày gần nhất (đơn cũ hơn đã nằm sẵn trong DB), và bỏ qua nếu
// vừa đồng bộ xong < 2 phút — mở tab/cron liên tục cũng chỉ tốn rất ít request (hạn mức Bay: 60/phút).
const SYNC_WINDOW_DAYS = 30;
const MIN_INTERVAL_MS = 2 * 60 * 1000;
let lastSync: { at: number; result: BaySyncResult } | null = null;

let inflight: Promise<BaySyncResult & { skipped?: boolean }> | null = null;

export async function syncBayShipments(maxPages = 20, force = false): Promise<BaySyncResult & { skipped?: boolean }> {
  if (!isBayConfigured()) throw new Error("Chưa cấu hình BAY_API_KEY");
  if (!force && lastSync && Date.now() - lastSync.at < MIN_INTERVAL_MS) {
    return { total: lastSync.result.total, created: [], alreadySynced: lastSync.result.alreadySynced, skipped: true };
  }
  // Nhiều tab/lần mở cùng lúc chỉ chạy 1 lần đồng bộ (tránh trùng việc và tạo trùng đơn FEB).
  if (inflight) return inflight;
  inflight = runSync(maxPages).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runSync(maxPages: number): Promise<BaySyncResult> {
  const createdFrom = new Date(Date.now() - SYNC_WINDOW_DAYS * 86400_000).toISOString();
  const shipments: BayShipment[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await bay.listShipments({ page, limit: 100, createdFrom });
    shipments.push(...res.data);
    if (page >= res.pagination.totalPages) break;
  }
  // Cũ → mới để số thứ tự FEB tăng theo thứ tự tạo.
  shipments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Nạp trước toàn bộ đơn/mã tracking đã có bằng 2 truy vấn, chỉ ghi DB khi dữ liệu thật sự đổi.
  const [existingCodes, byAwb] = await Promise.all([listFalcoCodeSet(), findOrdersByAwbs(shipments.map((s) => s.reference))]);
  const trackingByOrder = await listTrackingCodesByOrders([...byAwb.values()].map((o) => o.id));
  const created: BaySyncResult["created"] = [];
  let alreadySynced = 0;

  for (const s of shipments) {
    const trackingNumber = s.carrier.trackingNumber?.trim() || "";
    const service = BAY_SERVICE_NAME_VI[s.serviceType] ?? "Hàng hoá";
    const order = byAwb.get(s.reference);
    if (order) {
      alreadySynced++;
      const name = s.recipient.name ?? "";
      const phone = s.recipient.phone ?? "";
      const postcode = s.recipient.address.postalCode ?? "";
      const dest = destinationOf(s);
      const weight = s.parcel.weightKg.total ?? null;
      const changed =
        (name && name !== (order.recipient_name ?? "")) ||
        (phone && phone !== (order.recipient_phone ?? "")) ||
        (postcode && postcode !== (order.recipient_postcode ?? "")) ||
        (dest && dest !== (order.destination ?? "")) ||
        (weight !== null && Number(order.weight_kg) !== weight);
      if (order.service !== service) await setOrderService(order.id, service);
      // Bay có thể bổ sung/sửa thông tin người nhận sau khi đơn đã được đồng bộ.
      if (changed) await fillOrderBlanks(order.id, { recipientName: name, recipientPhone: phone, recipientPostcode: postcode, destination: dest, weightKg: weight });
      if (trackingNumber && !trackingByOrder.get(order.id)?.has(trackingNumber)) {
        await insertParcels(order.id, [{ hawb: s.reference, trackingCode: trackingNumber }]);
      }
      continue;
    }

    const falcoCode = nextFebCode(existingCodes, s.createdAt);
    existingCodes.add(falcoCode);
    const orderId = await insertOrder({
      falcoCode,
      awb: s.reference,
      recipientName: s.recipient.name ?? "",
      recipientPhone: s.recipient.phone ?? "",
      recipientPostcode: s.recipient.address.postalCode ?? "",
      service,
      destination: destinationOf(s),
      receivedDate: vnDateParts(s.createdAt).ymd,
      weightKg: s.parcel.weightKg.total ?? null,
      source: "staff",
      reviewStatus: "auto_approved",
    });
    if (trackingNumber) await insertParcels(orderId, [{ hawb: s.reference, trackingCode: trackingNumber }]);
    created.push({ reference: s.reference, falcoCode });
  }

  const result = { total: shipments.length, created, alreadySynced };
  lastSync = { at: Date.now(), result };
  return result;
}
