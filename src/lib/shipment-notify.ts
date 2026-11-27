import { timingSafeEqual } from "node:crypto";
import type mysql from "mysql2/promise";
import {
  extractDeliveredTime,
  getAttentionAlerts,
  OUT_FOR_DELIVERY_RE,
  parseKangoPayload,
  parseTrackingEventTime,
  type AlertReason,
  type DashboardAlertItem,
  type OrderTrackingQueryRow,
  type ParsedVnTime,
} from "./dashboard";
import { getPool } from "./db";
import type { KangoTrackingResponse } from "./kango";
import { resolveLastMile } from "./last-mile";
import type { ShipmentStatus } from "./shipment-status";

// ---------- Kiểu dữ liệu công khai ----------

export type NotifyEventKind =
  | "handed_over"
  | "out_for_delivery"
  | "delivered"
  | "customs_released"
  | "alert_customs_stuck"
  | "alert_no_update"
  | "alert_failed";

export type NotifyMessage = {
  key: string;
  text: string;
  eventIds: number[];
};

export type PendingNotifyResult = {
  quiet: boolean;
  messages: NotifyMessage[];
};

export type ScanShipmentEventsResult = {
  scannedOrders: number;
  detectedEvents: number;
  insertedEvents: number;
};

export type BaselineShipmentEventsResult = {
  scannedOrders: number;
  insertedEvents: number;
  markedNotified: number;
};

// ---------- Hằng số & biểu thức nhận diện sự kiện ----------

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const SCAN_WINDOW_DAYS = 60;
const MAX_LINES_PER_MESSAGE = 30;
const SQL_BATCH_SIZE = 500;

const EXPORT_SCAN_LEAVE_RE = /export scan\s*&\s*leave our warehouse/i;
const DEPARTED_RE = /\bdeparted\b/i;
const CUSTOMS_RELEASED_EVENT_RE =
  /destination customs released|đã thông quan nước đến|customs cleared|thông quan thành công/i;
const HANDED_OVER_EVENT_RE =
  /giao cho hãng vận chuyển nội địa|handed\s+(?:over\s+)?to\s+(?:local\s+)?carrier/i;

const ALERT_KINDS: ReadonlySet<NotifyEventKind> = new Set<NotifyEventKind>([
  "alert_failed",
  "alert_customs_stuck",
  "alert_no_update",
]);

const ALERT_PRIORITY: Record<"alert_failed" | "alert_customs_stuck" | "alert_no_update", number> = {
  alert_failed: 1,
  alert_customs_stuck: 2,
  alert_no_update: 3,
};

const ALERT_FALLBACK_BADGE: Record<"alert_failed" | "alert_customs_stuck" | "alert_no_update", string> = {
  alert_failed: "Giao thất bại / Hoàn trả",
  alert_customs_stuck: "Kẹt hải quan",
  alert_no_update: "Chưa cập nhật",
};

// ---------- Tự tạo bảng (idempotent, 1 lần mỗi tiến trình) ----------

let tableReady: Promise<void> | null = null;

export function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS shipment_notify_events (
           id INT AUTO_INCREMENT PRIMARY KEY,
           order_id INT NOT NULL,
           kind VARCHAR(32) NOT NULL,
           lot_date DATE NULL,
           event_at DATETIME NULL,
           created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
           notified_at DATETIME NULL,
           UNIQUE KEY uq_shipment_notify_order_kind (order_id, kind),
           INDEX idx_shipment_notify_pending (notified_at, kind),
           INDEX idx_shipment_notify_lot (lot_date),
           CONSTRAINT fk_shipment_notify_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

/** Xác thực agent ngoài qua header x-agent-api-key (dùng thêm lớp bảo vệ tại route handler). */
export function isValidNotifyAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  if (!key || !expected) return false;
  const a = Buffer.from(key, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- Tiện ích ngày giờ Việt Nam (UTC+7) ----------

function vnDateStringAt(now: Date, daysAgo = 0): string {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  vn.setUTCDate(vn.getUTCDate() - daysAgo);
  return vn.toISOString().slice(0, 10);
}

function epochMsToVnDateTime(epochMs: number): string {
  return new Date(epochMs + VN_OFFSET_MS).toISOString().slice(0, 19).replace("T", " ");
}

function formatDdMm(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

/** Bật lại khung im lặng 22h–7h bằng cách đổi thành true. Chủ yêu cầu gửi cả ngày (27/11/2026). */
const QUIET_HOURS_ENABLED = false;

/** Khung giờ im lặng: 22:00 đến trước 07:00 giờ Việt Nam (UTC+7). */
export function isQuietHoursVn(now: Date = new Date()): boolean {
  if (!QUIET_HOURS_ENABLED) return false;
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const hour = vn.getUTCHours();
  return hour >= 22 || hour < 7;
}

// ---------- Phân tích payload Kango / BayOnline ----------

type NotifyOrderRow = OrderTrackingQueryRow & {
  received_date: string | null;
  recipient_postcode: string | null;
};

type EnrichedOrder = {
  row: NotifyOrderRow;
  kango: KangoTrackingResponse | null;
  lotDate: string | null;
  carrier: string;
  trackingCode: string;
  /** Mọi mã chặng cuối của đơn (đơn nhiều kiện có nhiều mã) */
  trackingCodes: string[];
  isCustomsReleased: boolean;
};

type CandidateEvent = {
  orderId: number;
  kind: NotifyEventKind;
  lotDate: string | null;
  eventAt: string | null;
};

type PendingEventRow = {
  id: number;
  order_id: number;
  kind: NotifyEventKind;
  lot_date: string | null;
  event_at: string | null;
};

function extractTrackingCode(kango: KangoTrackingResponse | null): string {
  const direct = kango?.package_tracking_code?.trim();
  if (direct) return direct;
  const nums = kango?.shipment_information?.order_numbers ?? [];
  const current = nums.find((n) => n.is_current && n.package_tracking_code?.trim());
  if (current) return current.package_tracking_code.trim();
  const first = nums.find((n) => n.package_tracking_code?.trim());
  return first?.package_tracking_code.trim() ?? "";
}

function extractLastMileInfo(
  service: string | null,
  kango: KangoTrackingResponse | null
): { carrier: string; trackingCode: string } {
  const trackingCode = extractTrackingCode(kango);
  const explicitCarrier =
    kango?.carrier_code?.trim() ||
    kango?.additional_notes?.last_mile?.trim() ||
    "";
  const resolved = resolveLastMile(trackingCode, {
    service: kango?.additional_notes?.service || service || "",
    carrier: explicitCarrier,
  });
  const carrier = (resolved.carrier || explicitCarrier).trim().toUpperCase();
  return { carrier, trackingCode };
}

/** Ngày rời kho VN (YYYY-MM-DD, giờ VN): ưu tiên "Export Scan & Leave our warehouse", sau đó "DEPARTED". */
export function extractLotDate(kango: KangoTrackingResponse | null): string | null {
  const events = kango?.trackings ?? [];
  if (events.length === 0) return null;

  const pickEarliestDate = (re: RegExp): string | null => {
    let earliest: ParsedVnTime | null = null;
    for (const ev of events) {
      if (!re.test(ev.title ?? "")) continue;
      const parsed = parseTrackingEventTime(ev.time);
      if (parsed && (!earliest || parsed.epochMs < earliest.epochMs)) {
        earliest = parsed;
      }
    }
    return earliest ? earliest.dateVn : null;
  };

  return pickEarliestDate(EXPORT_SCAN_LEAVE_RE) ?? pickEarliestDate(DEPARTED_RE);
}

function extractLatestMatchingDateTime(
  kango: KangoTrackingResponse | null,
  re: RegExp
): string | null {
  const events = kango?.trackings ?? [];
  let latest: ParsedVnTime | null = null;
  for (const ev of events) {
    if (!re.test(ev.title ?? "")) continue;
    const parsed = parseTrackingEventTime(ev.time);
    if (parsed && (!latest || parsed.epochMs > latest.epochMs)) {
      latest = parsed;
    }
  }
  return latest ? epochMsToVnDateTime(latest.epochMs) : null;
}

function hasCustomsReleased(
  status: ShipmentStatus | null,
  kango: KangoTrackingResponse | null
): boolean {
  if (status === "returned") return false;
  if (status === "customs_released" || status === "last_mile" || status === "delivered") {
    return true;
  }
  const events = kango?.trackings ?? [];
  return events.some((ev) => CUSTOMS_RELEASED_EVENT_RE.test(ev.title ?? ""));
}

function alertReasonToKind(reason: AlertReason): "alert_customs_stuck" | "alert_no_update" | "alert_failed" {
  switch (reason) {
    case "customs_stuck":
      return "alert_customs_stuck";
    case "no_update":
      return "alert_no_update";
    case "failed_or_returned":
      return "alert_failed";
  }
}

function enrichOrderRow(row: NotifyOrderRow): EnrichedOrder {
  const kango = parseKangoPayload(row.payload);
  const { carrier, trackingCode } = extractLastMileInfo(row.service, kango);
  return {
    row,
    kango,
    lotDate: extractLotDate(kango),
    carrier,
    trackingCode,
    trackingCodes: extractAllTrackingCodes(kango, trackingCode),
    isCustomsReleased: hasCustomsReleased(row.shipment_status, kango),
  };
}

// ---------- Định dạng 1 dòng đơn & cắt giới hạn 30 dòng ----------

function extractAllTrackingCodes(kango: KangoTrackingResponse | null, primary: string): string[] {
  const codes = (kango?.shipment_information?.order_numbers ?? [])
    .map((n) => (n.package_tracking_code || "").trim())
    .filter(Boolean);
  const all = [...(primary ? [primary] : []), ...codes];
  return [...new Set(all)];
}

/** Mã nước 2 chữ từ "Thành phố, Nước" (tiếng Anh/Việt) — để dòng tin ngắn gọn. */
const COUNTRY_ISO2: Record<string, string> = {
  GERMANY: "DE", "ĐỨC": "DE", DUC: "DE", "UNITED KINGDOM": "UK", UK: "UK", ANH: "UK", ENGLAND: "UK",
  POLAND: "PL", "BA LAN": "PL", SPAIN: "ES", "TÂY BAN NHA": "ES", SLOVAKIA: "SK", "CZECH REPUBLIC": "CZ",
  CZECHIA: "CZ", "SÉC": "CZ", FRANCE: "FR", "PHÁP": "FR", NETHERLANDS: "NL", "HÀ LAN": "NL", ITALY: "IT",
  "Ý": "IT", AUSTRIA: "AT", "ÁO": "AT", BELGIUM: "BE", "BỈ": "BE", SWITZERLAND: "CH", DENMARK: "DK",
  SWEDEN: "SE", NORWAY: "NO", PORTUGAL: "PT", HUNGARY: "HU", IRELAND: "IE", ROMANIA: "RO", FINLAND: "FI",
  "UNITED STATES": "US", USA: "US", "MỸ": "US", CANADA: "CA", AUSTRALIA: "AU", "ÚC": "AU", JAPAN: "JP",
};
function countryIso2(destination: string | null): string {
  const raw = (destination || "").trim();
  if (!raw) return "";
  const last = raw.includes(",") ? raw.slice(raw.lastIndexOf(",") + 1).trim() : raw;
  const key = last.toUpperCase();
  return COUNTRY_ISO2[key] ?? (key.length <= 3 ? key : "");
}

/**
 * 1 dòng đơn, ngắn gọn để đọc nhanh:
 *   FL261120007 (19/11) Ha Sung · DE 10115 · DHL 00340434791629068686
 *   FL260915001 (15/09) Lan Anh · DE 12681 · DHL 4 kiện: mã1, mã2, mã3, mã4
 */
function formatOrderLine(order: EnrichedOrder): string {
  const ddmm = formatDdMm(order.row.received_date);
  const head = [order.row.falco_code + (ddmm ? ` (${ddmm})` : ""), order.row.recipient_name?.trim() || ""]
    .filter(Boolean)
    .join(" ");
  const place = [countryIso2(order.row.destination), order.row.recipient_postcode?.trim() || ""].filter(Boolean).join(" ");
  const codes = order.trackingCodes;
  const carrierPart =
    codes.length > 1
      ? `${order.carrier ? order.carrier + " " : ""}${codes.length} kiện: ${codes.join(", ")}`
      : [order.carrier, codes[0] ?? ""].filter(Boolean).join(" ");
  return [head, place, carrierPart].filter(Boolean).join(" · ");
}

function formatFallbackOrderLine(orderId: number): string {
  return `Đơn #${orderId}`;
}

function truncateLines(lines: string[], limit: number): string[] {
  if (lines.length <= limit) return lines;
  const remaining = lines.length - limit;
  return [...lines.slice(0, limit), `… và ${remaining} đơn khác`];
}

// ---------- Quét sự kiện từ DB tracking cache & cảnh báo ----------

type InternalScanOutput = ScanShipmentEventsResult & {
  trackedOrders: EnrichedOrder[];
  trackedByOrderId: Map<number, EnrichedOrder>;
  alertsByOrderId: Map<number, DashboardAlertItem>;
};

async function queryTrackedOrdersLast60Days(now: Date): Promise<NotifyOrderRow[]> {
  const cutoffDate = vnDateStringAt(now, SCAN_WINDOW_DAYS);
  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    `SELECT
       o.id, o.falco_code, o.awb, o.recipient_name, o.recipient_postcode, o.service, o.destination,
       DATE_FORMAT(o.received_date, '%Y-%m-%d') AS received_date,
       DATE_FORMAT(COALESCE(o.received_date, DATE(o.created_at)), '%Y-%m-%d') AS order_date,
       c.full_name AS ctv_full_name,
       tc.shipment_status, tc.current_status, tc.payload, tc.fetched_at
     FROM orders o
     INNER JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
     LEFT JOIN ctv_users c ON c.id = o.ctv_id
     WHERE o.review_status <> 'rejected'
       AND COALESCE(o.received_date, DATE(o.created_at)) >= ?
     ORDER BY o.id DESC`,
    [cutoffDate]
  );
  return rows as unknown as NotifyOrderRow[];
}

async function queryOrdersByIds(orderIds: number[]): Promise<NotifyOrderRow[]> {
  if (orderIds.length === 0) return [];
  const results: NotifyOrderRow[] = [];
  for (let i = 0; i < orderIds.length; i += SQL_BATCH_SIZE) {
    const chunk = orderIds.slice(i, i + SQL_BATCH_SIZE);
    const placeholders = chunk.map(() => "?").join(", ");
    const [rows] = await getPool().query<mysql.RowDataPacket[]>(
      `SELECT
         o.id, o.falco_code, o.awb, o.recipient_name, o.recipient_postcode, o.service, o.destination,
         DATE_FORMAT(o.received_date, '%Y-%m-%d') AS received_date,
         DATE_FORMAT(COALESCE(o.received_date, DATE(o.created_at)), '%Y-%m-%d') AS order_date,
         c.full_name AS ctv_full_name,
         tc.shipment_status, tc.current_status, tc.payload, tc.fetched_at
       FROM orders o
       LEFT JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
       LEFT JOIN ctv_users c ON c.id = o.ctv_id
       WHERE o.id IN (${placeholders})`,
      chunk
    );
    results.push(...(rows as unknown as NotifyOrderRow[]));
  }
  return results;
}

async function insertEventsIgnore(events: CandidateEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < events.length; i += SQL_BATCH_SIZE) {
    const chunk = events.slice(i, i + SQL_BATCH_SIZE);
    const values = chunk.map((e) => [e.orderId, e.kind, e.lotDate, e.eventAt]);
    const [res] = await getPool().query<mysql.ResultSetHeader>(
      "INSERT IGNORE INTO shipment_notify_events (order_id, kind, lot_date, event_at) VALUES ?",
      [values]
    );
    inserted += res.affectedRows;
  }
  return inserted;
}

async function scanShipmentEventsInternal(now: Date = new Date()): Promise<InternalScanOutput> {
  await ensureTable();

  const [rawRows, attention] = await Promise.all([
    queryTrackedOrdersLast60Days(now),
    getAttentionAlerts(1000),
  ]);

  const trackedOrders: EnrichedOrder[] = [];
  const trackedByOrderId = new Map<number, EnrichedOrder>();
  const candidates: CandidateEvent[] = [];

  for (const row of rawRows) {
    const enriched = enrichOrderRow(row);
    trackedOrders.push(enriched);
    trackedByOrderId.set(row.id, enriched);

    const status = row.shipment_status;
    const events = enriched.kango?.trackings ?? [];

    // 1. Đã thông quan nước đến (kèm lot_date tính từ ngày rời kho VN)
    if (enriched.isCustomsReleased) {
      candidates.push({
        orderId: row.id,
        kind: "customs_released",
        lotDate: enriched.lotDate,
        eventAt: extractLatestMatchingDateTime(enriched.kango, CUSTOMS_RELEASED_EVENT_RE),
      });
    }

    // 2. Đã nối hãng vận chuyển chặng cuối (chưa giao, chưa hoàn)
    if (status !== "delivered" && status !== "returned") {
      const hasHandoverEvent = events.some((ev) => HANDED_OVER_EVENT_RE.test(ev.title ?? ""));
      const hasLastMileCodeAndCarrier =
        enriched.trackingCode.length > 0 && enriched.carrier.length > 0;
      if (status === "last_mile" || hasHandoverEvent || hasLastMileCodeAndCarrier) {
        candidates.push({
          orderId: row.id,
          kind: "handed_over",
          lotDate: null,
          eventAt: extractLatestMatchingDateTime(enriched.kango, HANDED_OVER_EVENT_RE),
        });
      }

      // 3. Đang trên xe giao (khớp OUT_FOR_DELIVERY_RE và chưa delivered)
      const isOutForDelivery =
        events.some((ev) => OUT_FOR_DELIVERY_RE.test(ev.title ?? "")) ||
        OUT_FOR_DELIVERY_RE.test(row.current_status ?? "");
      if (isOutForDelivery) {
        candidates.push({
          orderId: row.id,
          kind: "out_for_delivery",
          lotDate: null,
          eventAt: extractLatestMatchingDateTime(enriched.kango, OUT_FOR_DELIVERY_RE),
        });
      }
    }

    // 4. Đã giao hàng (event_at = giờ giao theo giờ VN)
    if (status === "delivered") {
      const fetchedAtMs = row.fetched_at !== null ? Number(row.fetched_at) : null;
      const deliveredTime = extractDeliveredTime(enriched.kango, fetchedAtMs);
      candidates.push({
        orderId: row.id,
        kind: "delivered",
        lotDate: null,
        eventAt: deliveredTime ? epochMsToVnDateTime(deliveredTime.epochMs) : null,
      });
    }
  }

  // 5. Cảnh báo "Cần chú ý" (đã trừ đơn bị nhân viên bấm Ẩn)
  const alertsByOrderId = new Map<number, DashboardAlertItem>();
  for (const alert of attention.items) {
    alertsByOrderId.set(alert.id, alert);
    candidates.push({
      orderId: alert.id,
      kind: alertReasonToKind(alert.reason),
      lotDate: null,
      eventAt: alert.sortAt ? epochMsToVnDateTime(alert.sortAt) : null,
    });
  }

  const insertedEvents = await insertEventsIgnore(candidates);

  return {
    scannedOrders: trackedOrders.length,
    detectedEvents: candidates.length,
    insertedEvents,
    trackedOrders,
    trackedByOrderId,
    alertsByOrderId,
  };
}

/**
 * Quét đơn có tracking trong 60 ngày gần nhất và danh sách "Cần chú ý",
 * ghi nhận các sự kiện mới vào `shipment_notify_events` bằng INSERT IGNORE.
 */
export async function scanShipmentEvents(opts?: {
  now?: Date;
}): Promise<ScanShipmentEventsResult> {
  const res = await scanShipmentEventsInternal(opts?.now ?? new Date());
  return {
    scannedOrders: res.scannedOrders,
    detectedEvents: res.detectedEvents,
    insertedEvents: res.insertedEvents,
  };
}

/**
 * Chạy 1 lần lúc bật hệ thống thông báo: quét toàn bộ sự kiện hiện có rồi
 * đánh dấu đã gửi hết để tránh gửi dồn tin cũ.
 */
export async function baselineShipmentEvents(): Promise<BaselineShipmentEventsResult> {
  const scan = await scanShipmentEventsInternal(new Date());
  const [result] = await getPool().query<mysql.ResultSetHeader>(
    "UPDATE shipment_notify_events SET notified_at = NOW() WHERE notified_at IS NULL"
  );
  return {
    scannedOrders: scan.scannedOrders,
    insertedEvents: scan.insertedEvents,
    markedNotified: result.affectedRows,
  };
}

// ---------- Dựng tin nhắn chờ gửi cho n8n ----------

function buildSimpleListMessage(params: {
  key: string;
  header: string;
  lines: string[];
  eventIds: number[];
}): NotifyMessage {
  const bodyLines = truncateLines(params.lines, MAX_LINES_PER_MESSAGE);
  return {
    key: params.key,
    text: [params.header, ...bodyLines].join("\n"),
    eventIds: params.eventIds,
  };
}

function buildCustomsLotMessages(
  customsEvents: PendingEventRow[],
  ordersById: Map<number, EnrichedOrder>,
  trackedOrders: EnrichedOrder[]
): NotifyMessage[] {
  if (customsEvents.length === 0) return [];

  // Lập bảng lô từ toàn bộ đơn 60 ngày (tính từ payload, không chỉ bảng sự kiện)
  const lotOrdersMap = new Map<string, EnrichedOrder[]>();
  for (const ord of trackedOrders) {
    if (!ord.lotDate) continue;
    const list = lotOrdersMap.get(ord.lotDate);
    if (list) list.push(ord);
    else lotOrdersMap.set(ord.lotDate, [ord]);
  }

  // Nhóm sự kiện customs_released chờ gửi theo lot_date
  const pendingByLot = new Map<string, PendingEventRow[]>();
  for (const ev of customsEvents) {
    const ord = ordersById.get(ev.order_id);
    const effectiveLot = ord?.lotDate ?? ev.lot_date ?? "unknown";
    const list = pendingByLot.get(effectiveLot);
    if (list) list.push(ev);
    else pendingByLot.set(effectiveLot, [ev]);
  }

  const sortedLotKeys = [...pendingByLot.keys()].sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return a.localeCompare(b);
  });

  const messages: NotifyMessage[] = [];

  for (const lotKey of sortedLotKeys) {
    const groupEvents = pendingByLot.get(lotKey) ?? [];
    const eventIds = groupEvents.map((e) => e.id);
    const newlyClearedLines = groupEvents.map((e) => {
      const ord = ordersById.get(e.order_id);
      return ord ? formatOrderLine(ord) : formatFallbackOrderLine(e.order_id);
    });

    if (lotKey === "unknown") {
      const shownNew = truncateLines(newlyClearedLines, MAX_LINES_PER_MESSAGE);
      const text = [
        `🛃 THÔNG QUAN · chưa rõ lô (${groupEvents.length})`,
        `✔ Vừa thông quan (${groupEvents.length}):`,
        ...shownNew,
      ].join("\n");
      messages.push({ key: "customs_released:unknown", text, eventIds });
      continue;
    }

    const pendingOrderIds = new Set(groupEvents.map((e) => e.order_id));
    const lotOrders = lotOrdersMap.get(lotKey) ?? [];

    let previouslyClearedCount = 0;
    const notYetClearedOrders: EnrichedOrder[] = [];

    for (const ord of lotOrders) {
      if (pendingOrderIds.has(ord.row.id)) continue;
      if (ord.row.shipment_status === "returned") continue;
      if (ord.isCustomsReleased) {
        previouslyClearedCount++;
      } else if (ord.row.shipment_status !== "delivered") {
        notYetClearedOrders.push(ord);
      }
    }

    const totalInLot = groupEvents.length + previouslyClearedCount + notYetClearedOrders.length;
    const notYetClearedLines = notYetClearedOrders.map((ord) => formatOrderLine(ord));

    // Giữ tổng số dòng đơn trong 1 tin lô không vượt quá MAX_LINES_PER_MESSAGE (30)
    const newLimit =
      notYetClearedLines.length > 0
        ? Math.min(
            newlyClearedLines.length,
            Math.max(20, MAX_LINES_PER_MESSAGE - notYetClearedLines.length)
          )
        : MAX_LINES_PER_MESSAGE;
    const pendingLimit = Math.max(0, MAX_LINES_PER_MESSAGE - Math.min(newlyClearedLines.length, newLimit));

    const sections: string[] = [
      `🛃 THÔNG QUAN · Lô ${formatDdMm(lotKey)} · ${previouslyClearedCount + groupEvents.length}/${totalInLot} đơn đã thông quan`,
      `✔ Vừa thông quan (${groupEvents.length}):`,
      ...truncateLines(newlyClearedLines, newLimit),
      ...(previouslyClearedCount > 0 ? [`Trước đó đã thông quan: ${previouslyClearedCount}`] : []),
    ];

    if (notYetClearedLines.length > 0) {
      sections.push(`⏳ Chưa thông quan (${notYetClearedLines.length}):`);
      if (pendingLimit > 0) {
        sections.push(...truncateLines(notYetClearedLines, pendingLimit));
      } else {
        sections.push(`… và ${notYetClearedLines.length} đơn khác`);
      }
    }

    messages.push({
      key: `customs_released:${lotKey}`,
      text: sections.join("\n"),
      eventIds,
    });
  }

  return messages;
}

/**
 * Quét sự kiện mới rồi tổng hợp các tin nhắn chưa gửi (notified_at IS NULL).
 * Trong khung giờ im lặng 22:00–07:00 giờ VN, trả quiet=true và messages=[]
 * (trừ khi ignoreQuiet=true để xem trước, sự kiện vẫn giữ nguyên chưa ack).
 */
export async function buildPendingMessages(opts?: {
  now?: Date;
  ignoreQuiet?: boolean;
}): Promise<PendingNotifyResult> {
  const now = opts?.now ?? new Date();
  const scan = await scanShipmentEventsInternal(now);
  const quiet = isQuietHoursVn(now);

  if (quiet && !opts?.ignoreQuiet) {
    return { quiet: true, messages: [] };
  }

  const [rawPending] = await getPool().query<mysql.RowDataPacket[]>(
    `SELECT
       id,
       order_id,
       kind,
       DATE_FORMAT(lot_date, '%Y-%m-%d') AS lot_date,
       DATE_FORMAT(event_at, '%Y-%m-%d %H:%i:%s') AS event_at
     FROM shipment_notify_events
     WHERE notified_at IS NULL
     ORDER BY id ASC`
  );
  const pendingRows = rawPending as unknown as PendingEventRow[];
  if (pendingRows.length === 0) {
    return { quiet, messages: [] };
  }

  // Nạp thêm thông tin đơn cho các sự kiện nằm ngoài cửa sổ 60 ngày có tracking
  // (vd đơn cảnh báo 61–90 ngày hoặc đơn chưa có cache tracking).
  const ordersById = new Map<number, EnrichedOrder>(scan.trackedByOrderId);
  const missingOrderIds = [
    ...new Set(pendingRows.map((r) => r.order_id).filter((id) => !ordersById.has(id))),
  ];
  if (missingOrderIds.length > 0) {
    const extraRows = await queryOrdersByIds(missingOrderIds);
    for (const row of extraRows) {
      ordersById.set(row.id, enrichOrderRow(row));
    }
  }

  const handedOverEvents: PendingEventRow[] = [];
  const outForDeliveryEvents: PendingEventRow[] = [];
  const deliveredEvents: PendingEventRow[] = [];
  const customsEvents: PendingEventRow[] = [];
  const alertEvents: PendingEventRow[] = [];

  for (const ev of pendingRows) {
    if (ev.kind === "handed_over") handedOverEvents.push(ev);
    else if (ev.kind === "out_for_delivery") outForDeliveryEvents.push(ev);
    else if (ev.kind === "delivered") deliveredEvents.push(ev);
    else if (ev.kind === "customs_released") customsEvents.push(ev);
    else if (ALERT_KINDS.has(ev.kind)) alertEvents.push(ev);
  }

  const messages: NotifyMessage[] = [];

  // 1. Đã nối hãng vận chuyển
  if (handedOverEvents.length > 0) {
    const lines = handedOverEvents.map((ev) => {
      const ord = ordersById.get(ev.order_id);
      return ord ? formatOrderLine(ord) : formatFallbackOrderLine(ev.order_id);
    });
    messages.push(
      buildSimpleListMessage({
        key: "handed_over",
        header: `🔗 NỐI HÃNG VC (${handedOverEvents.length})`,
        lines,
        eventIds: handedOverEvents.map((e) => e.id),
      })
    );
  }

  // 2. Thông quan theo từng lô
  messages.push(...buildCustomsLotMessages(customsEvents, ordersById, scan.trackedOrders));

  // 3. Sắp giao – đang trên xe giao
  if (outForDeliveryEvents.length > 0) {
    const lines = outForDeliveryEvents.map((ev) => {
      const ord = ordersById.get(ev.order_id);
      return ord ? formatOrderLine(ord) : formatFallbackOrderLine(ev.order_id);
    });
    messages.push(
      buildSimpleListMessage({
        key: "out_for_delivery",
        header: `🚚 SẮP GIAO – trên xe giao (${outForDeliveryEvents.length})`,
        lines,
        eventIds: outForDeliveryEvents.map((e) => e.id),
      })
    );
  }

  // 4. Đã giao (kèm giờ giao HH:mm)
  if (deliveredEvents.length > 0) {
    const sortedDelivered = [...deliveredEvents].sort((a, b) =>
      (b.event_at ?? "").localeCompare(a.event_at ?? "") || b.order_id - a.order_id
    );
    const lines = sortedDelivered.map((ev) => {
      const ord = ordersById.get(ev.order_id);
      const base = ord ? formatOrderLine(ord) : formatFallbackOrderLine(ev.order_id);
      let hhmm = ev.event_at && ev.event_at.length >= 16 ? ev.event_at.slice(11, 16) : "";
      if (!hhmm && ord) {
        const fetchedAtMs = ord.row.fetched_at !== null ? Number(ord.row.fetched_at) : null;
        hhmm = extractDeliveredTime(ord.kango, fetchedAtMs)?.hhmm ?? "";
      }
      return hhmm ? `${base} · ${hhmm}` : base;
    });
    messages.push(
      buildSimpleListMessage({
        key: "delivered",
        header: `✅ ĐÃ GIAO (${sortedDelivered.length})`,
        lines,
        eventIds: sortedDelivered.map((e) => e.id),
      })
    );
  }

  // 5. Cần chú ý (gom 3 loại cảnh báo, gộp trùng đơn nếu có nhưng vẫn ack hết eventIds)
  if (alertEvents.length > 0) {
    type AlertEntry = {
      orderId: number;
      priority: number;
      sortAt: number;
      badge: string;
    };
    const byOrder = new Map<number, AlertEntry>();
    for (const ev of alertEvents) {
      const kind = ev.kind as "alert_failed" | "alert_customs_stuck" | "alert_no_update";
      const priority = ALERT_PRIORITY[kind];
      const liveAlert = scan.alertsByOrderId.get(ev.order_id);
      const badge = liveAlert?.badge || ALERT_FALLBACK_BADGE[kind];
      const sortAt = liveAlert?.sortAt ?? 0;

      const existing = byOrder.get(ev.order_id);
      if (!existing || priority < existing.priority) {
        byOrder.set(ev.order_id, { orderId: ev.order_id, priority, sortAt, badge });
      }
    }

    const sortedEntries = [...byOrder.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.priority === 1) return b.sortAt - a.sortAt || b.orderId - a.orderId;
      return a.sortAt - b.sortAt || b.orderId - a.orderId;
    });

    const lines = sortedEntries.map((entry) => {
      const ord = ordersById.get(entry.orderId);
      const base = ord ? formatOrderLine(ord) : formatFallbackOrderLine(entry.orderId);
      return entry.badge ? `${base} · ${entry.badge}` : base;
    });

    messages.push(
      buildSimpleListMessage({
        key: "attention",
        header: `⚠️ CẦN CHÚ Ý (${sortedEntries.length})`,
        lines,
        eventIds: alertEvents.map((e) => e.id),
      })
    );
  }

  return { quiet, messages };
}

/** Đánh dấu các sự kiện đã được gửi Zalo (notified_at = NOW()). */
export async function ackEvents(ids: number[]): Promise<{ updated: number }> {
  await ensureTable();
  const cleanIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (cleanIds.length === 0) return { updated: 0 };

  let updated = 0;
  for (let i = 0; i < cleanIds.length; i += SQL_BATCH_SIZE) {
    const chunk = cleanIds.slice(i, i + SQL_BATCH_SIZE);
    const placeholders = chunk.map(() => "?").join(", ");
    const [result] = await getPool().query<mysql.ResultSetHeader>(
      `UPDATE shipment_notify_events
       SET notified_at = NOW()
       WHERE id IN (${placeholders}) AND notified_at IS NULL`,
      chunk
    );
    updated += result.affectedRows;
  }
  return { updated };
}
