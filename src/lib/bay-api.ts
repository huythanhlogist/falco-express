// Client cho BayOnline Partner API v1 (https://agency.bayonlinevn.com/api-docs).
// Chỉ gọi từ server (route /api/admin/bay/*): API key tuyệt đối không đưa ra
// trình duyệt. Key đặt trong biến môi trường BAY_API_KEY — repo này public nên
// không ghi key vào mã nguồn.

const DEFAULT_BASE_URL = "https://partner-api.bayonlinevn.com";
const TIMEOUT_MS = 10_000;
const MAX_RETRY_WAIT_S = 5;

export type BayShipmentStatus =
  | "agency_created"
  | "created"
  | "checked"
  | "weighed"
  | "to_airport"
  | "in_flight"
  | "customs_cleared"
  | "at_destination_warehouse"
  | "handed_to_carrier"
  | "completed"
  | "cancelled"
  | "held_at_destination_warehouse";

export type BayTrackingStatus =
  | "label_created"
  | "picked_up"
  | "in_transit"
  | "at_facility"
  | "customs"
  | "out_for_delivery"
  | "available_for_pickup"
  | "delivery_attempted"
  | "delivered"
  | "exception"
  | "returned"
  | "cancelled"
  | "unknown";

export type BayWeightKg = {
  total?: number | null;
  regular: number | null;
  liquid: number | null;
  perishable: number | null;
  counterfeit: number | null;
  electronic: number | null;
};

export type BayShipment = {
  reference: string;
  partnerReference: string | null;
  status: BayShipmentStatus | string;
  onHold: boolean;
  serviceType: string;
  createdAt: string;
  updatedAt: string;
  sender: { name: string | null; phone: string | null; email: string | null; address: string | null };
  recipient: {
    name: string | null;
    company: string | null;
    phone: string | null;
    email: string | null;
    address: {
      line1: string | null;
      houseNumber: string | null;
      line2: string | null;
      line3: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      countryCode: string | null;
    };
  };
  parcel: {
    weightKg: BayWeightKg;
    dimensionsCm: { length: number; width: number; height: number } | null;
    volumetricWeightKg: number | null;
  };
  items: { description: string; quantity: number; unit: string | null }[];
  carrier: { code: string | null; trackingNumber: string | null; trackingUrl: string | null };
  timestamps: Record<string, string | null>;
};

export type BayTrackingEvent = {
  source: "bay" | "carrier";
  code: string;
  description: string | null;
  notes: string | null;
  location: string | null;
  countryCode: string | null;
  packageCode: string | null;
  images: string[];
  occurredAt: string;
};

export type BayTracking = {
  reference: string;
  partnerReference: string | null;
  createdBy: string | null;
  shipmentStatus: BayShipmentStatus | string;
  carrier: { code: string | null; trackingNumber: string | null; trackingUrl: string | null; assignedAt: string | null };
  trackingStatus: BayTrackingStatus | string | null;
  lastUpdatedAt: string | null;
  receiveItems: { code: string; quantity: number; receivedAt: string | null; images: string[] }[];
  events: BayTrackingEvent[];
};

export type BayShipmentList = {
  data: BayShipment[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type BayWarehouse = { code: string; name: string; address: string };

export type BayMe = {
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: { perMinute: number; perDay: number };
};

export type BayDraftOrderInput = {
  partnerReference?: string;
  serviceType?: "air" | "sea" | "cold";
  note?: string;
  sender?: { name?: string; phone?: string; email?: string; address?: string };
  recipient: {
    name: string;
    phone: string;
    email: string;
    company?: string;
    address: {
      line1: string;
      houseNumber?: string;
      line2?: string;
      line3?: string;
      city: string;
      state?: string;
      postalCode: string;
      countryCode: string;
    };
  };
  parcels: {
    items: { description: string; quantity: number; unit?: string }[];
    weightKg?: Partial<Omit<BayWeightKg, "total">>;
    dimensionsCm?: { length: number; width: number; height: number };
    imagesWeighed: string[];
    imagesChecked?: string[];
  }[];
};

export class BayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null,
    readonly details?: unknown,
    readonly retryAfter?: number
  ) {
    super(message);
    this.name = "BayApiError";
  }
}

export function isBayConfigured(): boolean {
  return Boolean(process.env.BAY_API_KEY);
}

type RequestOptions = {
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  /** Header Idempotency-Key — chỉ cần cho POST tạo đơn nháp, để gọi lại không sinh trùng. */
  idempotencyKey?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gọi 1 endpoint của Partner API. GET tự thử lại khi 429/503; POST không thử lại tự động. */
export async function bayRequest<T>(method: "GET" | "POST", path: string, opts: RequestOptions = {}): Promise<T> {
  const apiKey = process.env.BAY_API_KEY;
  if (!apiKey) throw new BayApiError("Chưa cấu hình BAY_API_KEY", 503, "not_configured", null);

  const base = (process.env.BAY_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { "X-API-Key": apiKey, Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const maxAttempts = method === "GET" ? 3 : 1;
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (err) {
      if (attempt < maxAttempts) {
        await sleep(attempt * 1000);
        continue;
      }
      const msg = err instanceof Error ? err.message : "Không kết nối được tới BayOnline";
      throw new BayApiError(msg, 504, "network_error", null);
    }

    if (res.ok) return (await res.json()) as T;

    const json = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string; requestId?: string; details?: unknown };
    } | null;
    const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
    const retryable = res.status === 429 || res.status === 503;
    if (retryable && attempt < maxAttempts) {
      await sleep(Math.min(retryAfter ?? attempt * 2, MAX_RETRY_WAIT_S) * 1000);
      continue;
    }
    throw new BayApiError(
      json?.error?.message ?? `BayOnline trả về lỗi HTTP ${res.status}`,
      res.status,
      json?.error?.code ?? "unknown_error",
      json?.error?.requestId ?? res.headers.get("X-Request-Id"),
      json?.error?.details,
      retryAfter
    );
  }
}

export const bay = {
  me: () => bayRequest<BayMe>("GET", "/api/v1/me"),
  warehouses: () => bayRequest<{ data: BayWarehouse[] }>("GET", "/api/v1/warehouses"),
  listShipments: (q: {
    page?: number;
    limit?: number;
    status?: string;
    partnerReference?: string;
    createdFrom?: string;
    createdTo?: string;
  }) => bayRequest<BayShipmentList>("GET", "/api/v1/shipments", { query: q }),
  getShipment: (reference: string) =>
    bayRequest<BayShipment>("GET", `/api/v1/shipments/${encodeURIComponent(reference)}`),
  getTracking: (reference: string) =>
    bayRequest<BayTracking>("GET", `/api/v1/shipments/${encodeURIComponent(reference)}/tracking`),
  createDraftOrder: (input: BayDraftOrderInput, idempotencyKey?: string) =>
    bayRequest<Record<string, unknown>>("POST", "/api/v1/draft-orders", { body: input, idempotencyKey }),
  confirmDraftOrder: (reference: string, warehouseCode: string) =>
    bayRequest<Record<string, unknown>>("POST", `/api/v1/draft-orders/${encodeURIComponent(reference)}/confirm`, {
      body: { warehouseCode },
    }),
};

export { BAY_STATUS_LABELS } from "./bay-labels";
