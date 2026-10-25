import {
  listOrdersNeedingTrackingRefresh,
  markTrackingCacheError,
  upsertTrackingCache,
  type OrderRecord,
  type TrackingCacheRow,
} from "./db";
import { fetchBayTrackingAsKango } from "./bay-tracking";
import { fetchKangoTracking, type KangoTrackingResponse } from "./kango";
import { resolveLastMile } from "./last-mile";
import { isFinalShipmentStatus, mapKangoStatus, type ShipmentStatus } from "./shipment-status";
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
  parcels: { hawb: string; trackingCode: string; status: string; trackingUrl: string | null; carrier: string }[];
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

  const service = kango.additional_notes.service || order.service || "";
  const parcels = kango.shipment_information.order_numbers
    .filter((p) => p.package_tracking_code?.trim())
    .map((p) => {
      const lastMile = resolveLastMile(p.package_tracking_code, {
        service,
        carrier: kango.additional_notes.last_mile,
        kangoUrl: p.tracking_url,
      });
      return {
        package_hawb_code: p.package_hawb_code,
        package_tracking_code: p.package_tracking_code.trim(),
        status: p.status,
        trackingUrl: lastMile.url,
        carrier: lastMile.carrier,
      };
    });

  return {
    falcoCode: order.falco_code,
    awb: order.awb,
    recipientName: order.recipient_name || "",
    service,
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
    parcels: parcels.map((p) => ({
      hawb: p.package_hawb_code,
      trackingCode: p.package_tracking_code,
      status: p.status,
      trackingUrl: p.trackingUrl,
      carrier: p.carrier,
    })),
    lastMileCarrier: kango.additional_notes.last_mile || parcels[0]?.carrier || "",
    lastMileWebsite: kango.additional_notes.last_mile_website || "",
    contactInformation: kango.additional_notes.contact_information || "",
    ksnPostUrl,
  };
}

/**
 * Lấy hành trình của 1 đơn từ đúng nguồn: đơn mã FEB… là vận đơn BayOnline (orders.awb là mã Bay),
 * còn lại là Kango. Cả hai trả về cùng dạng Kango; đơn Bay kèm sẵn trạng thái đã quy đổi.
 */
export async function fetchTrackingFor(
  order: Pick<OrderRecord, "falco_code" | "awb">
): Promise<{ kango: KangoTrackingResponse | null; status?: ShipmentStatus }> {
  if (order.falco_code.toUpperCase().startsWith("FEB")) {
    const r = await fetchBayTrackingAsKango(order.awb);
    return r ? { kango: r.kango, status: r.status } : { kango: null };
  }
  return { kango: await fetchKangoTracking(order.awb) };
}

export async function saveKangoToCache(
  order: Pick<OrderRecord, "id" | "awb">,
  kango: KangoTrackingResponse | null,
  statusOverride?: ShipmentStatus
): Promise<void> {
  await upsertTrackingCache({
    orderId: order.id,
    awb: order.awb,
    status: statusOverride ?? mapKangoStatus(kango),
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
  // Tuần tự từng đơn: API Kango vốn chậm (6-7s/lượt) và dùng chung hạ tầng với web
  // của họ, nên không dồn nhiều request song song.
  const concurrency = opts?.concurrency ?? 1;
  const budgetMs = opts?.budgetMs ?? 20 * 60 * 1000;
  // Cron gọi mỗi giờ: chỉ làm mới bản cache đã quá 50 phút, nên mỗi đơn chưa
  // giao được cập nhật khoảng mỗi giờ 1 lần, và gọi chồng/gọi thừa thì chỉ
  // xử lý phần còn lại (hoặc không làm gì).
  const staleAfterMs = opts?.staleAfterMs ?? 50 * 60 * 1000;
  const startedAt = Date.now();

  const candidates = await listOrdersNeedingTrackingRefresh(
    vnDateString(windowDays),
    1000,
    Date.now() - staleAfterMs
  );
  let next = 0;
  let refreshed = 0;
  let failed = 0;
  // Kango lỗi/treo liên tiếp (sự cố hoặc bị giới hạn tần suất) thì dừng cả
  // lượt thay vì tiếp tục dồn request; lượt sau (1 giờ nữa) sẽ thử lại.
  const MAX_CONSECUTIVE_FAILURES = 5;
  let consecutiveFailures = 0;

  async function worker() {
    while (
      next < candidates.length &&
      Date.now() - startedAt < budgetMs &&
      consecutiveFailures < MAX_CONSECUTIVE_FAILURES
    ) {
      const order = candidates[next++];
      try {
        const { kango, status } = await fetchTrackingFor(order);
        await saveKangoToCache(order, kango, status);
        refreshed++;
        consecutiveFailures = 0;
      } catch (err) {
        failed++;
        consecutiveFailures++;
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
