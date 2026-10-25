import { findOrderByAwb, insertOrder, insertParcels, listFalcoCodeSet, setOrderService, syncOrderParcel } from "./db";
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

export async function syncBayShipments(maxPages = 20, force = false): Promise<BaySyncResult & { skipped?: boolean }> {
  if (!isBayConfigured()) throw new Error("Chưa cấu hình BAY_API_KEY");
  if (!force && lastSync && Date.now() - lastSync.at < MIN_INTERVAL_MS) {
    return { total: lastSync.result.total, created: [], alreadySynced: lastSync.result.alreadySynced, skipped: true };
  }

  const createdFrom = new Date(Date.now() - SYNC_WINDOW_DAYS * 86400_000).toISOString();
  const shipments: BayShipment[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await bay.listShipments({ page, limit: 100, createdFrom });
    shipments.push(...res.data);
    if (page >= res.pagination.totalPages) break;
  }
  // Cũ → mới để số thứ tự FEB tăng theo thứ tự tạo.
  shipments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const existingCodes = await listFalcoCodeSet();
  const created: BaySyncResult["created"] = [];
  let alreadySynced = 0;

  for (const s of shipments) {
    const trackingNumber = s.carrier.trackingNumber?.trim() || "";
    const order = await findOrderByAwb(s.reference);
    if (order) {
      alreadySynced++;
      await setOrderService(order.id, BAY_SERVICE_NAME_VI[s.serviceType] ?? "Hàng hoá");
      if (trackingNumber) await syncOrderParcel(order.id, s.reference, trackingNumber);
      continue;
    }

    const falcoCode = nextFebCode(existingCodes, s.createdAt);
    existingCodes.add(falcoCode);
    const orderId = await insertOrder({
      falcoCode,
      awb: s.reference,
      recipientName: s.recipient.name ?? "",
      recipientPhone: s.recipient.phone ?? "",
      service: BAY_SERVICE_NAME_VI[s.serviceType] ?? "Hàng hoá",
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
