import { getPool, type TrackingCacheRow } from "@/lib/db";
import {
  DhlConfigError,
  DhlRateLimitError,
  fetchDhlTracking,
  parseDhlTimestampMs,
  type DhlTrackingData,
} from "./dhl-tracking";
import { resolveLastMile } from "./last-mile";
import { parseCachedKango } from "./tracking-cache";
import { vnDateString } from "./vn-date";

const DEFAULT_MAX_CALLS = 10;
const DEFAULT_WINDOW_DAYS = 30;
const DEFAULT_STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 giờ giữa 2 lần gọi lại cùng 1 mã
const DEFAULT_DELAY_MS = 5_000; // DHL miễn phí giới hạn ~1 lượt / 5 giây
const MAX_CANDIDATE_ORDERS = 1000;
const MAX_CONSECUTIVE_ERRORS = 5;

export type RefreshDhlLastMileOptions = {
  maxCalls?: number;
  windowDays?: number;
  staleAfterMs?: number;
  delayMs?: number;
};

export type RefreshDhlLastMileSummary = {
  scannedOrders: number;
  candidates: number;
  called: number;
  updated: number;
  notFound: number;
  failed: number;
  rateLimited: boolean;
  stoppedByMaxCalls: boolean;
  elapsedMs: number;
};

type CandidateOrderRow = TrackingCacheRow & {
  order_service: string | null;
};

type ExistingLastMileRow = {
  order_id: number;
  code: string;
  status_code: string;
  delivered_at: number | string | null;
  fetched_at: number | string;
};

type DhlCodeTask = {
  orderId: number;
  code: string;
  previousFetchedAt: number | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDhlCarrier(carrier: string): boolean {
  return /\bdhl\b/i.test(carrier);
}

/**
 * Rút danh sách mã tracking chặng cuối thuộc hãng DHL từ payload Kango đã cache.
 * Chỉ dùng lại `parseCachedKango` và `resolveLastMile` có sẵn.
 */
function extractDhlCodesFromCache(row: CandidateOrderRow): string[] {
  const kango = parseCachedKango(row);
  if (!kango) return [];

  const service = kango.additional_notes?.service || row.order_service || "";
  const carrierHint = kango.additional_notes?.last_mile || "";
  const orderNumbers = kango.shipment_information?.order_numbers ?? [];

  const seen = new Set<string>();
  const codes: string[] = [];

  const maybeAdd = (rawCode: string | null | undefined, kangoUrl?: string | null) => {
    const code = rawCode?.trim();
    if (!code) return;
    const key = code.toUpperCase();
    if (seen.has(key)) return;

    const resolved = resolveLastMile(code, {
      service,
      carrier: carrierHint,
      kangoUrl: kangoUrl ?? null,
    });
    if (!isDhlCarrier(resolved.carrier)) return;

    seen.add(key);
    codes.push(code);
  };

  for (const parcel of orderNumbers) {
    maybeAdd(parcel.package_tracking_code, parcel.tracking_url);
  }

  // Phòng trường hợp payload Kango chỉ có package_tracking_code ở cấp gốc (không có trong order_numbers)
  if (codes.length === 0 && kango.package_tracking_code) {
    const rootCode = kango.package_tracking_code.trim();
    if (rootCode && rootCode.toUpperCase() !== row.awb.trim().toUpperCase()) {
      maybeAdd(rootCode, kango.tracking_url);
    }
  }

  return codes;
}

async function listCandidateTrackingRows(sinceDate: string): Promise<CandidateOrderRow[]> {
  const [rows] = await getPool().query(
    `SELECT
       tc.order_id, tc.awb, tc.shipment_status, tc.current_status,
       tc.payload, tc.fetched_at, tc.last_error,
       o.service AS order_service
     FROM order_tracking_cache tc
     JOIN orders o ON o.id = tc.order_id AND tc.awb = o.awb
     WHERE o.review_status IN ('auto_approved', 'approved')
       AND COALESCE(o.received_date, DATE(o.created_at)) >= ?
       AND tc.payload IS NOT NULL
       AND (
         tc.shipment_status NOT IN ('delivered', 'returned')
         OR (
           tc.shipment_status = 'delivered'
           AND (
             NOT EXISTS (
               SELECT 1
               FROM order_last_mile_tracking lm
               WHERE lm.order_id = tc.order_id
                 AND lm.carrier = 'DHL'
             )
             OR EXISTS (
               SELECT 1
               FROM order_last_mile_tracking lm
               WHERE lm.order_id = tc.order_id
                 AND lm.carrier = 'DHL'
                 AND lm.delivered_at IS NULL
             )
           )
         )
       )
     ORDER BY tc.fetched_at DESC
     LIMIT ?`,
    [sinceDate, MAX_CANDIDATE_ORDERS]
  );
  return rows as CandidateOrderRow[];
}

async function loadExistingLastMileMap(orderIds: number[]): Promise<Map<string, ExistingLastMileRow>> {
  const map = new Map<string, ExistingLastMileRow>();
  if (orderIds.length === 0) return map;

  const uniqueIds = [...new Set(orderIds)];
  const placeholders = uniqueIds.map(() => "?").join(", ");
  const [rows] = await getPool().query(
    `SELECT order_id, code, status_code, delivered_at, fetched_at
     FROM order_last_mile_tracking
     WHERE order_id IN (${placeholders})`,
    uniqueIds
  );

  for (const row of rows as ExistingLastMileRow[]) {
    map.set(`${row.order_id}:${row.code.toUpperCase()}`, row);
  }
  return map;
}

async function upsertDhlResult(orderId: number, code: string, data: DhlTrackingData, fetchedAt: number): Promise<void> {
  const lastEventAtMs = parseDhlTimestampMs(data.lastEventAt);
  const deliveredAtMs = parseDhlTimestampMs(data.deliveredAt);
  const estimatedDeliveryMs = parseDhlTimestampMs(data.estimatedDelivery);

  await getPool().query(
    `INSERT INTO order_last_mile_tracking
       (order_id, code, carrier, status_code, status_text, last_event_at, delivered_at,
        estimated_delivery, failed, payload, fetched_at, last_error)
     VALUES (?, ?, 'DHL', ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
       carrier = VALUES(carrier),
       status_code = VALUES(status_code),
       status_text = VALUES(status_text),
       last_event_at = VALUES(last_event_at),
       delivered_at = COALESCE(VALUES(delivered_at), delivered_at),
       estimated_delivery = VALUES(estimated_delivery),
       failed = VALUES(failed),
       payload = VALUES(payload),
       fetched_at = VALUES(fetched_at),
       last_error = NULL`,
    [
      orderId,
      code,
      data.statusCode,
      data.statusText ? data.statusText.slice(0, 255) : null,
      lastEventAtMs,
      deliveredAtMs,
      estimatedDeliveryMs,
      data.failed ? 1 : 0,
      JSON.stringify(data),
      fetchedAt,
    ]
  );
}

async function upsertDhlNotFound(orderId: number, code: string, fetchedAt: number): Promise<void> {
  // Nếu mã đã từng có dữ liệu trước đó thì giữ nguyên trạng thái/payload cũ, chỉ cập nhật fetched_at để chờ đủ 6 giờ.
  await getPool().query(
    `INSERT INTO order_last_mile_tracking
       (order_id, code, carrier, status_code, status_text, last_event_at, delivered_at,
        estimated_delivery, failed, payload, fetched_at, last_error)
     VALUES (?, ?, 'DHL', 'not_found', NULL, NULL, NULL, NULL, 0, NULL, ?, NULL)
     ON DUPLICATE KEY UPDATE
       fetched_at = VALUES(fetched_at),
       last_error = NULL`,
    [orderId, code, fetchedAt]
  );
}

async function upsertDhlError(orderId: number, code: string, message: string, fetchedAt: number): Promise<void> {
  await getPool().query(
    `INSERT INTO order_last_mile_tracking
       (order_id, code, carrier, status_code, status_text, last_event_at, delivered_at,
        estimated_delivery, failed, payload, fetched_at, last_error)
     VALUES (?, ?, 'DHL', 'unknown', NULL, NULL, NULL, NULL, 0, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE
       fetched_at = VALUES(fetched_at),
       last_error = VALUES(last_error)`,
    [orderId, code, fetchedAt, message.slice(0, 255)]
  );
}

/**
 * Đồng bộ trạng thái chặng cuối cho các mã vận đơn DHL từ cache Kango trong `windowDays` ngày gần nhất.
 * - Bỏ qua mã đã giao (`status_code = 'delivered'` hoặc đã có `delivered_at`).
 * - Chỉ gọi lại mã có `fetched_at` cũ hơn 6 giờ (hoặc chưa từng gọi).
 * - Nghỉ 5 giây giữa 2 lượt gọi để tôn trọng giới hạn miễn phí của DHL.
 * - Dừng ngay khi đạt `maxCalls` hoặc gặp HTTP 429 (`DhlRateLimitError`).
 */
export async function refreshDhlLastMile(
  opts?: RefreshDhlLastMileOptions
): Promise<RefreshDhlLastMileSummary> {
  const maxCalls = Math.max(0, Math.floor(opts?.maxCalls ?? DEFAULT_MAX_CALLS));
  const windowDays = opts?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const staleAfterMs = opts?.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const delayMs = opts?.delayMs ?? DEFAULT_DELAY_MS;
  const startedAt = Date.now();

  const sinceDate = vnDateString(windowDays);
  const candidateRows = await listCandidateTrackingRows(sinceDate);

  // Rút toàn bộ cặp (orderId, code) thuộc hãng DHL từ payload Kango
  const extractedPairs: { orderId: number; code: string }[] = [];
  for (const row of candidateRows) {
    const codes = extractDhlCodesFromCache(row);
    for (const code of codes) {
      extractedPairs.push({ orderId: row.order_id, code });
    }
  }

  const existingMap = await loadExistingLastMileMap(extractedPairs.map((p) => p.orderId));
  const now = Date.now();

  const tasks: DhlCodeTask[] = [];
  for (const pair of extractedPairs) {
    const existing = existingMap.get(`${pair.orderId}:${pair.code.toUpperCase()}`);
    if (existing) {
      // Mã đã giao thì không gọi lại nữa để tiết kiệm hạn mức ngày
      if (existing.status_code === "delivered" || existing.delivered_at !== null) {
        continue;
      }
      const prevFetchedAt = Number(existing.fetched_at);
      if (Number.isFinite(prevFetchedAt) && now - prevFetchedAt < staleAfterMs) {
        continue;
      }
      tasks.push({
        orderId: pair.orderId,
        code: pair.code,
        previousFetchedAt: Number.isFinite(prevFetchedAt) ? prevFetchedAt : null,
      });
    } else {
      tasks.push({
        orderId: pair.orderId,
        code: pair.code,
        previousFetchedAt: null,
      });
    }
  }

  // Ưu tiên mã chưa từng tra trước, sau đó tới mã có fetched_at cũ nhất
  tasks.sort((a, b) => {
    if (a.previousFetchedAt === null && b.previousFetchedAt === null) return 0;
    if (a.previousFetchedAt === null) return -1;
    if (b.previousFetchedAt === null) return 1;
    return a.previousFetchedAt - b.previousFetchedAt;
  });

  let called = 0;
  let updated = 0;
  let notFound = 0;
  let failed = 0;
  let rateLimited = false;
  let stoppedByMaxCalls = false;
  let consecutiveErrors = 0;

  for (const task of tasks) {
    if (called >= maxCalls) {
      stoppedByMaxCalls = true;
      break;
    }
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      break;
    }
    if (called > 0 && delayMs > 0) {
      await sleep(delayMs);
    }

    called++;
    try {
      const result = await fetchDhlTracking(task.code);
      const fetchedAt = Date.now();
      if (result === "notFound") {
        await upsertDhlNotFound(task.orderId, task.code, fetchedAt);
        notFound++;
      } else {
        await upsertDhlResult(task.orderId, task.code, result, fetchedAt);
        updated++;
      }
      consecutiveErrors = 0;
    } catch (err) {
      if (err instanceof DhlConfigError) {
        throw err;
      }
      if (err instanceof DhlRateLimitError) {
        rateLimited = true;
        console.warn(`[last-mile-sync] Dừng sớm do DHL giới hạn tần suất (429): ${err.message}`);
        break;
      }
      failed++;
      consecutiveErrors++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[last-mile-sync] Lỗi tra mã DHL ${task.code} (đơn #${task.orderId}):`, message);
      await upsertDhlError(task.orderId, task.code, message, Date.now()).catch(() => {});
    }
  }

  return {
    scannedOrders: candidateRows.length,
    candidates: tasks.length,
    called,
    updated,
    notFound,
    failed,
    rateLimited,
    stoppedByMaxCalls,
    elapsedMs: Date.now() - startedAt,
  };
}
