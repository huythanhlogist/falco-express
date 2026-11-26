import { getPool } from "@/lib/db";
import { parseDhlTimestampMs } from "./dhl-tracking";
import { vnDateString } from "./vn-date";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 50;

// Nhận diện sự kiện cuối cùng đang đi phát của DHL ("out for delivery" / "with delivery courier")
const OUT_FOR_DELIVERY_RE = /out for delivery|with delivery courier/i;

export type DhlDashboardItem = {
  orderId: number;
  awb: string;
  code: string;
  statusText: string;
  /** Thời điểm sự kiện theo giờ Việt Nam (UTC+7), dạng "YYYY-MM-DDTHH:mm:ss+07:00" */
  at: string | null;
};

type LastMileQueryRow = {
  order_id: number;
  awb: string;
  code: string;
  status_text: string | null;
  last_event_at: number | string | null;
  delivered_at: number | string | null;
  fetched_at: number | string;
  payload: unknown;
};

type PayloadEventLike = {
  timestamp?: string | null;
  description?: string | null;
  status?: string | null;
};

function vnMidnightEpochMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - VN_OFFSET_MS;
}

function toEpochMs(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatEpochMsVn(epochMs: number | null): string | null {
  if (epochMs === null || !Number.isFinite(epochMs)) return null;
  const vn = new Date(epochMs + VN_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}` +
    `T${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}:${pad(vn.getUTCSeconds())}+07:00`
  );
}

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; errno?: number };
  return e.code === "ER_NO_SUCH_TABLE" || e.errno === 1146;
}

function parseJsonPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      const parsed: unknown = JSON.parse(payload);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof payload === "object") {
    return payload as Record<string, unknown>;
  }
  return null;
}

function extractLatestEventText(payload: unknown): string | null {
  const parsed = parseJsonPayload(payload);
  if (!parsed) return null;

  let rawEvents: unknown[] = [];
  if (Array.isArray(parsed.events)) {
    rawEvents = parsed.events;
  } else if (Array.isArray(parsed.shipments)) {
    const firstShipment = parsed.shipments[0];
    if (firstShipment && typeof firstShipment === "object") {
      const maybeEvents = (firstShipment as { events?: unknown }).events;
      if (Array.isArray(maybeEvents)) rawEvents = maybeEvents;
    }
  }

  if (rawEvents.length === 0) return null;

  let latestText: string | null = null;
  let latestMs: number | null = null;

  for (const item of rawEvents) {
    if (!item || typeof item !== "object") continue;
    const ev = item as PayloadEventLike;
    const text = (ev.description?.trim() || ev.status?.trim() || "").trim();
    if (!text) continue;

    const tsMs = parseDhlTimestampMs(ev.timestamp);
    if (latestText === null) {
      latestText = text;
      latestMs = tsMs;
    } else if (tsMs !== null && (latestMs === null || tsMs > latestMs)) {
      latestText = text;
      latestMs = tsMs;
    }
  }

  return latestText;
}

/**
 * Danh sách mã DHL đã giao trong ngày hôm nay (tính theo giờ Việt Nam UTC+7).
 */
export async function getDhlDeliveredToday(limit = DEFAULT_LIMIT): Promise<DhlDashboardItem[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const todayVn = vnDateString(0);
  const startMs = vnMidnightEpochMs(todayVn);
  const endMs = startMs + DAY_MS;

  try {
    const [rows] = await getPool().query(
      `SELECT lm.order_id, o.awb, lm.code, lm.status_text, lm.last_event_at, lm.delivered_at, lm.fetched_at, lm.payload
       FROM order_last_mile_tracking lm
       JOIN orders o ON o.id = lm.order_id
       WHERE lm.carrier = 'DHL'
         AND lm.status_code = 'delivered'
         AND lm.delivered_at >= ?
         AND lm.delivered_at < ?
       ORDER BY lm.delivered_at DESC, lm.order_id DESC
       LIMIT ?`,
      [startMs, endMs, safeLimit]
    );

    return (rows as LastMileQueryRow[]).map((row) => ({
      orderId: row.order_id,
      awb: row.awb,
      code: row.code,
      statusText: row.status_text?.trim() || "Đã giao hàng",
      at: formatEpochMsVn(toEpochMs(row.delivered_at) ?? toEpochMs(row.last_event_at)),
    }));
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

/**
 * Danh sách mã DHL đang đi phát hôm nay: `status_code = 'transit'` và sự kiện cuối
 * chứa cụm "out for delivery" hoặc "with delivery courier".
 */
export async function getDhlOutForDelivery(limit = DEFAULT_LIMIT): Promise<DhlDashboardItem[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const scanLimit = Math.max(safeLimit * 5, 250);

  try {
    const [rows] = await getPool().query(
      `SELECT lm.order_id, o.awb, lm.code, lm.status_text, lm.last_event_at, lm.delivered_at, lm.fetched_at, lm.payload
       FROM order_last_mile_tracking lm
       JOIN orders o ON o.id = lm.order_id
       WHERE lm.carrier = 'DHL'
         AND lm.status_code = 'transit'
       ORDER BY COALESCE(lm.last_event_at, lm.fetched_at) DESC, lm.order_id DESC
       LIMIT ?`,
      [scanLimit]
    );

    const matched: DhlDashboardItem[] = [];
    for (const row of rows as LastMileQueryRow[]) {
      const latestEventText = extractLatestEventText(row.payload);
      const checkText = latestEventText ?? row.status_text ?? "";
      if (!OUT_FOR_DELIVERY_RE.test(checkText)) continue;

      matched.push({
        orderId: row.order_id,
        awb: row.awb,
        code: row.code,
        statusText: latestEventText || row.status_text?.trim() || "Đang đi phát",
        at: formatEpochMsVn(toEpochMs(row.last_event_at) ?? toEpochMs(row.fetched_at)),
      });
      if (matched.length >= safeLimit) break;
    }

    return matched;
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}

/**
 * Danh sách mã DHL gặp sự cố giao hàng (`status_code = 'failure'` hoặc `failed = 1`).
 */
export async function getDhlFailures(limit = DEFAULT_LIMIT): Promise<DhlDashboardItem[]> {
  const safeLimit = Math.max(1, Math.floor(limit));

  try {
    const [rows] = await getPool().query(
      `SELECT lm.order_id, o.awb, lm.code, lm.status_text, lm.last_event_at, lm.delivered_at, lm.fetched_at, lm.payload
       FROM order_last_mile_tracking lm
       JOIN orders o ON o.id = lm.order_id
       WHERE lm.carrier = 'DHL'
         AND (lm.status_code = 'failure' OR lm.failed = 1)
       ORDER BY COALESCE(lm.last_event_at, lm.fetched_at) DESC, lm.order_id DESC
       LIMIT ?`,
      [safeLimit]
    );

    return (rows as LastMileQueryRow[]).map((row) => ({
      orderId: row.order_id,
      awb: row.awb,
      code: row.code,
      statusText: row.status_text?.trim() || "Giao hàng thất bại",
      at: formatEpochMsVn(toEpochMs(row.last_event_at) ?? toEpochMs(row.fetched_at)),
    }));
  } catch (err) {
    if (isMissingTableError(err)) return [];
    throw err;
  }
}
