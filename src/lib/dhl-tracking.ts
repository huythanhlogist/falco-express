/**
 * Kết nối DHL Shipment Tracking Unified API (miễn phí, 250 lượt/ngày, ~1 lượt/5s)
 * để tra cứu trạng thái chặng cuối của các mã vận đơn DHL.
 *
 * Tài liệu: GET https://api-eu.dhl.com/track/shipments?trackingNumber=<mã>
 * Header:   DHL-API-Key: <process.env.DHL_API_KEY>
 */

const DHL_TRACKING_API_URL = "https://api-eu.dhl.com/track/shipments";
const DHL_TIMEOUT_MS = 15_000;

export type DhlStatusCode = "pre-transit" | "transit" | "delivered" | "failure" | "unknown";

export type DhlTrackingEvent = {
  timestamp: string | null;
  statusCode: DhlStatusCode;
  description: string;
  location: string | null;
};

export type DhlTrackingData = {
  statusCode: DhlStatusCode;
  statusText: string;
  lastEventAt: string | null;
  deliveredAt: string | null;
  estimatedDelivery: string | null;
  failed: boolean;
  events: DhlTrackingEvent[];
};

export type DhlTrackingResult = DhlTrackingData | "notFound";

/** Lỗi cấu hình khi chưa khai báo DHL_API_KEY. */
export class DhlConfigError extends Error {
  constructor(message = "Thiếu biến môi trường DHL_API_KEY") {
    super(message);
    this.name = "DhlConfigError";
  }
}

/** Lỗi riêng khi DHL API trả HTTP 429 (vượt hạn mức ngày hoặc giới hạn tần suất) để dừng lượt cron ngay. */
export class DhlRateLimitError extends Error {
  readonly status = 429;
  readonly retryAfterSeconds: number | null;

  constructor(message = "DHL API vượt hạn mức (HTTP 429)", retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "DhlRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type DhlApiLocation = {
  address?: {
    addressLocality?: string;
    countryCode?: string;
    postalCode?: string;
  };
};

type DhlApiStatus = {
  timestamp?: string;
  statusCode?: string;
  status?: string;
  description?: string;
  location?: DhlApiLocation;
};

type DhlApiShipment = {
  id?: string;
  service?: string;
  status?: DhlApiStatus;
  events?: DhlApiStatus[];
  estimatedTimeOfDelivery?: string;
  estimatedDeliveryTimeFrame?: {
    estimatedFrom?: string;
    estimatedThrough?: string;
  };
};

type DhlApiResponse = {
  shipments?: DhlApiShipment[];
};

export function isDhlConfigured(): boolean {
  return Boolean(process.env.DHL_API_KEY?.trim());
}

export function normalizeDhlStatusCode(raw: string | null | undefined): DhlStatusCode {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "pre-transit":
      return "pre-transit";
    case "transit":
      return "transit";
    case "delivered":
      return "delivered";
    case "failure":
      return "failure";
    default:
      return "unknown";
  }
}

/**
 * Chuyển chuỗi thời gian ISO của DHL sang epoch mili-giây (không phụ thuộc TZ của tiến trình Node).
 * Chuỗi không kèm múi giờ (vd "2026-11-26T14:30:00" hoặc "2026-11-26") được hiểu theo UTC để ổn định.
 */
export function parseDhlTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    normalized = `${trimmed}T00:00:00Z`;
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
    normalized = `${trimmed.replace(" ", "T")}Z`;
  }

  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

function parseRetryAfterSeconds(header: string | null): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const targetMs = Date.parse(trimmed);
  if (Number.isFinite(targetMs)) {
    return Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
  }
  return null;
}

function normalizeShipment(shipment: DhlApiShipment): DhlTrackingData {
  const rawEvents = Array.isArray(shipment.events) ? shipment.events : [];

  // Sắp xếp sự kiện mới nhất lên đầu (giữ nguyên thứ tự gốc nếu thiếu timestamp)
  const events: DhlTrackingEvent[] = rawEvents
    .map((ev) => ({
      timestamp: ev.timestamp?.trim() || null,
      statusCode: normalizeDhlStatusCode(ev.statusCode),
      description: (ev.description?.trim() || ev.status?.trim() || "").trim(),
      location: ev.location?.address?.addressLocality?.trim() || null,
    }))
    .sort((a, b) => {
      const ta = parseDhlTimestampMs(a.timestamp);
      const tb = parseDhlTimestampMs(b.timestamp);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta;
    });

  const statusCode = normalizeDhlStatusCode(shipment.status?.statusCode ?? events[0]?.statusCode);
  const statusText =
    shipment.status?.description?.trim() ||
    shipment.status?.status?.trim() ||
    events[0]?.description ||
    statusCode;

  const lastEventAt = shipment.status?.timestamp?.trim() || events[0]?.timestamp || null;

  let deliveredAt: string | null = null;
  if (statusCode === "delivered") {
    deliveredAt =
      shipment.status?.timestamp?.trim() ||
      events.find((e) => e.statusCode === "delivered")?.timestamp ||
      events[0]?.timestamp ||
      null;
  }

  const estimatedDelivery =
    shipment.estimatedTimeOfDelivery?.trim() ||
    shipment.estimatedDeliveryTimeFrame?.estimatedThrough?.trim() ||
    shipment.estimatedDeliveryTimeFrame?.estimatedFrom?.trim() ||
    null;

  return {
    statusCode,
    statusText,
    lastEventAt,
    deliveredAt,
    estimatedDelivery,
    failed: statusCode === "failure",
    events,
  };
}

/**
 * Tra cứu 1 mã vận đơn qua DHL Shipment Tracking Unified API.
 * - Thiếu DHL_API_KEY: ném `DhlConfigError`.
 * - HTTP 404 (hoặc danh sách shipments rỗng): trả về `"notFound"`.
 * - HTTP 429: ném `DhlRateLimitError` để vòng cron dừng ngay lập tức.
 * - Timeout: 15 giây qua `AbortController`.
 */
export async function fetchDhlTracking(code: string): Promise<DhlTrackingResult> {
  const apiKey = process.env.DHL_API_KEY?.trim();
  if (!apiKey) {
    throw new DhlConfigError(
      "Thiếu biến môi trường DHL_API_KEY — cần cấu hình key DHL Shipment Tracking Unified API"
    );
  }

  const trimmedCode = code.trim();
  if (!trimmedCode) {
    throw new Error("Mã vận đơn DHL trống");
  }

  const url = `${DHL_TRACKING_API_URL}?trackingNumber=${encodeURIComponent(trimmedCode)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DHL_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "DHL-API-Key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (res.status === 404) {
      return "notFound";
    }

    if (res.status === 429) {
      const retryAfter = parseRetryAfterSeconds(res.headers.get("retry-after"));
      throw new DhlRateLimitError(
        retryAfter !== null
          ? `DHL API vượt hạn mức (HTTP 429, thử lại sau ${retryAfter}s)`
          : "DHL API vượt hạn mức (HTTP 429)",
        retryAfter
      );
    }

    if (!res.ok) {
      let detail = "";
      try {
        const text = (await res.text()).trim();
        if (text) detail = `: ${text.slice(0, 200)}`;
      } catch {
        // Bỏ qua lỗi đọc body phụ
      }
      throw new Error(`DHL API trả về lỗi HTTP ${res.status}${detail}`);
    }

    const data = (await res.json()) as DhlApiResponse;
    const shipment = Array.isArray(data.shipments) ? data.shipments[0] : undefined;
    if (!shipment) {
      return "notFound";
    }

    return normalizeShipment(shipment);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`DHL API quá thời gian chờ (${DHL_TIMEOUT_MS / 1000}s) cho mã ${trimmedCode}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
