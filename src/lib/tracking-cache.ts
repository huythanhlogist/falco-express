import {
  listOrdersNeedingTrackingRefresh,
  markTrackingCacheError,
  upsertTrackingCache,
  type OrderRecord,
  type TrackingCacheRow,
} from "./db";
import { fetchKangoTracking, type KangoTrackingResponse } from "./kango";
import { isFinalShipmentStatus, mapKangoStatus } from "./shipment-status";
import { vnDateString } from "./vn-date";

// Đơn đã giao/hoàn: dữ liệu không đổi nữa nên cache dùng mãi. Đơn đang đi: cron
// làm mới mỗi ngày, quá 36h tức cron đã lỡ nên trang tra cứu thử gọi live lại.
// Đơn Kango chưa có dữ liệu (payload null) hay có dữ liệu vào bất cứ lúc nào
// nên chỉ tin cache ngắn hơn.
const CACHE_FRESH_MS = 36 * 60 * 60 * 1000;
const CACHE_FRESH_EMPTY_MS = 3 * 60 * 60 * 1000;

export function isTrackingCacheFresh(cache: TrackingCacheRow, now = Date.now()): boolean {
  if (isFinalShipmentStatus(cache.shipment_status)) return true;
  const ttl = cache.payload ? CACHE_FRESH_MS : CACHE_FRESH_EMPTY_MS;
  return now - cache.fetched_at < ttl;
}

export function parseCachedKango(cache: TrackingCacheRow): KangoTrackingResponse | null {
  if (!cache.payload) return null;
  try {
    return JSON.parse(cache.payload) as KangoTrackingResponse;
  } catch {
    return null;
  }
}

export type PublicTrackingData = {
  falcoCode: string;
  awb: string;
  recipientName: string;
  service: string;
  destination: string;
  currentStatus: string;
  steps: { title: string; time: string; location: string | null }[];
  parcels: { hawb: string; trackingCode: string; status: string; trackingUrl: string | null }[];
  lastMileCarrier: string;
  lastMileWebsite: string;
  contactInformation: string;
  ksnPostUrl: string;
};

export function buildTrackingData(
  order: Pick<OrderRecord, "falco_code" | "awb" | "recipient_name" | "service" | "destination">,
  kango: KangoTrackingResponse | null
): PublicTrackingData {
  const ksnPostUrl = `https://www.ksnpost.com/?code=${encodeURIComponent(order.awb)}`;

  if (!kango) {
    // Đơn có trong hệ thống Falco nhưng Kango chưa có dữ liệu (đơn quá mới,
    // chưa được quét lần đầu) — vẫn trả về thông tin cơ bản.
    return {
      falcoCode: order.falco_code,
      awb: order.awb,
      recipientName: order.recipient_name || "",
      service: order.service || "",
      destination: order.destination || "",
      currentStatus: "Đã tiếp nhận, đang chờ cập nhật từ đối tác vận chuyển",
      steps: [],
      parcels: [],
      lastMileCarrier: "",
      lastMileWebsite: "",
      contactInformation: "",
      ksnPostUrl,
    };
  }

  const currentParcel =
    kango.shipment_information.order_numbers.find((p) => p.is_current) ??
    kango.shipment_information.order_numbers[0];

  return {
    falcoCode: order.falco_code,
    awb: order.awb,
    recipientName: order.recipient_name || "",
    service: kango.additional_notes.service || order.service || "",
    destination: kango.additional_notes.country || order.destination || "",
    // Ưu tiên tiêu đề mốc thời gian mới nhất (trackings[0]) thay vì
    // currentParcel.status — trường status của Kango có thể chưa đồng bộ
    // kịp (vd vẫn ghi "In Transit" dù mốc mới nhất đã là "delivered"),
    // trong khi trackings[0] luôn khớp với mốc đầu tiên hiển thị bên dưới.
    currentStatus: kango.trackings[0]?.title || currentParcel?.status || "Chưa cập nhật",
    steps: kango.trackings.map((t) => ({
      title: t.title,
      time: t.time,
      location: t.location,
    })),
    parcels: kango.shipment_information.order_numbers.map((p) => ({
      hawb: p.package_hawb_code,
      trackingCode: p.package_tracking_code,
      status: p.status,
      trackingUrl: p.tracking_url,
    })),
    lastMileCarrier: kango.additional_notes.last_mile || "",
    lastMileWebsite: kango.additional_notes.last_mile_website || "",
    contactInformation: kango.additional_notes.contact_information || "",
    ksnPostUrl,
  };
}

export async function saveKangoToCache(
  order: Pick<OrderRecord, "id" | "awb">,
  kango: KangoTrackingResponse | null
): Promise<void> {
  await upsertTrackingCache({
    orderId: order.id,
    awb: order.awb,
    status: mapKangoStatus(kango),
    currentStatus: kango?.trackings?.[0]?.title ?? null,
    payload: kango ? JSON.stringify(kango) : null,
  });
}

export type RefreshSummary = {
  candidates: number;
  refreshed: number;
  failed: number;
  skippedByBudget: number;
  elapsedMs: number;
};

/**
 * Làm mới cache tracking cho đơn trong `windowDays` ngày gần nhất chưa giao/hoàn.
 * Gọi Kango với `concurrency` luồng song song (chưa rõ Kango có giới hạn tần
 * suất không nên giữ thấp), dừng nhận đơn mới khi hết `budgetMs` — đơn còn lại
 * sẽ được ưu tiên ở lần chạy sau (xem listOrdersNeedingTrackingRefresh).
 */
export async function refreshTrackingCache(opts?: {
  windowDays?: number;
  concurrency?: number;
  budgetMs?: number;
  staleAfterMs?: number;
}): Promise<RefreshSummary> {
  const windowDays = opts?.windowDays ?? 30;
  const concurrency = opts?.concurrency ?? 3;
  const budgetMs = opts?.budgetMs ?? 8 * 60 * 1000;
  // Chỉ làm mới bản cache đã quá 20h — gọi lại endpoint nhiều lần trong ngày
  // (hoặc lượt trước hết ngân sách giữa chừng) thì chỉ xử lý phần còn lại.
  const staleAfterMs = opts?.staleAfterMs ?? 20 * 60 * 60 * 1000;
  const startedAt = Date.now();

  const candidates = await listOrdersNeedingTrackingRefresh(
    vnDateString(windowDays),
    1000,
    Date.now() - staleAfterMs
  );
  let next = 0;
  let refreshed = 0;
  let failed = 0;

  async function worker() {
    while (next < candidates.length && Date.now() - startedAt < budgetMs) {
      const order = candidates[next++];
      try {
        const kango = await fetchKangoTracking(order.awb);
        await saveKangoToCache(order, kango);
        refreshed++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[tracking-cache] Lỗi làm mới đơn ${order.id} (${order.awb}):`, message);
        await markTrackingCacheError(order.id, message).catch(() => {});
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return {
    candidates: candidates.length,
    refreshed,
    failed,
    skippedByBudget: Math.max(0, candidates.length - next),
    elapsedMs: Date.now() - startedAt,
  };
}
