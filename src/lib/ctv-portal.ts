import type { RowDataPacket } from "mysql2";
import { getPool, type OrderReviewStatus, type PaymentStatus } from "./db";
import type { ShipmentStatus } from "./shipment-status";

// Dữ liệu cho cổng CTV mới (Đơn hàng · Thống kê · Tài chính · Tracking Site).
// MỌI hàm nhận ctvId từ phiên đăng nhập (không bao giờ từ client) và luôn lọc theo ctv_id.
// Thống kê/tài chính chỉ tính đơn đã được chấp nhận: approved (CTV tạo, admin duyệt) hoặc
// auto_approved (admin gán cho CTV).

const COUNTED = "o.review_status IN ('approved','auto_approved')";

// ---------- Đơn hàng ----------

export type CtvOrderRow = {
  id: number;
  falco_code: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  service: string | null;
  destination: string | null;
  received_date: string | null;
  weight_kg: string | null;
  amount: string | null;
  review_status: OrderReviewStatus;
  payment_status: PaymentStatus;
  source: "staff" | "ctv";
  shipment_status: ShipmentStatus | null;
  shipment_current: string | null;
  tracking_code: string | null;
};

export async function listCtvOrders(
  ctvId: number,
  p: { search?: string; status?: string; limit: number; offset: number }
): Promise<{ orders: CtvOrderRow[]; total: number }> {
  const cond = ["o.ctv_id = ?"];
  const args: unknown[] = [ctvId];
  const q = (p.search ?? "").trim();
  if (q) {
    const like = `%${q}%`;
    cond.push(
      `(o.falco_code LIKE ? OR o.recipient_name LIKE ? OR o.recipient_phone LIKE ?
        OR EXISTS (SELECT 1 FROM order_parcels op WHERE op.order_id = o.id AND op.tracking_code LIKE ?))`
    );
    args.push(like, like, like, like);
  }
  if (p.status === "pending" || p.status === "rejected") {
    cond.push("o.review_status = ?");
    args.push(p.status);
  } else if (p.status && p.status !== "all") {
    cond.push("tc.shipment_status = ?");
    args.push(p.status);
  }
  const where = cond.join(" AND ");
  const from = `FROM orders o LEFT JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb`;

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT o.id, o.falco_code, o.recipient_name, o.recipient_phone, o.service, o.destination, o.received_date,
            o.weight_kg, o.amount, o.review_status, o.payment_status, o.source,
            tc.shipment_status, tc.current_status AS shipment_current,
            (SELECT op.tracking_code FROM order_parcels op WHERE op.order_id = o.id ORDER BY op.id LIMIT 1) AS tracking_code
     ${from} WHERE ${where}
     ORDER BY o.received_date DESC, o.id DESC LIMIT ? OFFSET ?`,
    [...args, p.limit, p.offset]
  );
  const [cnt] = await getPool().query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${from} WHERE ${where}`, args);
  return { orders: rows as CtvOrderRow[], total: Number(cnt[0]?.n ?? 0) };
}

// ---------- Thống kê ----------

export type StatsPeriod = "month" | "quarter" | "year";

export type CtvStats = {
  period: StatsPeriod;
  label: string;
  from: string;
  to: string; // không bao gồm
  orders: number;
  weightKg: number;
  revenue: number;
  prev: { orders: number; weightKg: number; revenue: number };
  trend: { month: string; orders: number; weightKg: number; revenue: number }[]; // 12 tháng gần nhất đến tháng của kỳ
  byCustomer: { name: string; orders: number; weightKg: number; revenue: number }[];
  byCountry: { country: string; orders: number; weightKg: number; revenue: number }[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number) => `${y}-${pad(m)}-01`;

/** ref: "YYYY-MM" (tháng/quý: tháng bất kỳ trong quý) hoặc "YYYY" (năm). */
export function periodRange(period: StatsPeriod, ref: string): { from: string; to: string; prevFrom: string; label: string } {
  const y = Number(ref.slice(0, 4)) || new Date().getFullYear();
  const m = Number(ref.slice(5, 7)) || 1;
  if (period === "year") {
    return { from: ymd(y, 1), to: ymd(y + 1, 1), prevFrom: ymd(y - 1, 1), label: `Năm ${y}` };
  }
  if (period === "quarter") {
    const q = Math.floor((m - 1) / 3);
    const sm = q * 3 + 1;
    const next = sm + 3 > 12 ? ymd(y + 1, 1) : ymd(y, sm + 3);
    const prev = sm - 3 < 1 ? ymd(y - 1, sm + 9) : ymd(y, sm - 3);
    return { from: ymd(y, sm), to: next, prevFrom: prev, label: `Quý ${q + 1}/${y}` };
  }
  const next = m === 12 ? ymd(y + 1, 1) : ymd(y, m + 1);
  const prev = m === 1 ? ymd(y - 1, 12) : ymd(y, m - 1);
  return { from: ymd(y, m), to: next, prevFrom: prev, label: `Tháng ${m}/${y}` };
}

async function totals(ctvId: number, from: string, to: string) {
  const [r] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(o.weight_kg),0) AS kg, COALESCE(SUM(o.amount),0) AS revenue
     FROM orders o WHERE o.ctv_id = ? AND ${COUNTED} AND o.received_date >= ? AND o.received_date < ?`,
    [ctvId, from, to]
  );
  return { orders: Number(r[0].orders), weightKg: Number(r[0].kg), revenue: Number(r[0].revenue) };
}

export async function getCtvStats(ctvId: number, period: StatsPeriod, ref: string): Promise<CtvStats> {
  const { from, to, prevFrom, label } = periodRange(period, ref);
  // Xu hướng: 12 tháng kết thúc ở tháng cuối của kỳ đang xem.
  const end = new Date(`${to}T00:00:00Z`);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 12, 1));
  const pool = getPool();

  // 5 truy vấn độc lập → chạy song song (trước đây tuần tự nên mỗi lần mở trang chờ cộng dồn).
  const [cur, prev, [t], [cust], [dest]] = await Promise.all([
    totals(ctvId, from, to),
    totals(ctvId, prevFrom, from),
    pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(o.received_date, '%Y-%m') AS ym, COUNT(*) AS orders,
              COALESCE(SUM(o.weight_kg),0) AS kg, COALESCE(SUM(o.amount),0) AS revenue
       FROM orders o WHERE o.ctv_id = ? AND ${COUNTED} AND o.received_date >= ? AND o.received_date < ?
       GROUP BY ym`,
      [ctvId, start.toISOString().slice(0, 10), to]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT COALESCE(NULLIF(TRIM(o.recipient_name),''),'(không tên)') AS name, COUNT(*) AS orders,
              COALESCE(SUM(o.weight_kg),0) AS kg, COALESCE(SUM(o.amount),0) AS revenue
       FROM orders o WHERE o.ctv_id = ? AND ${COUNTED} AND o.received_date >= ? AND o.received_date < ?
       GROUP BY name ORDER BY kg DESC, orders DESC LIMIT 10`,
      [ctvId, from, to]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT o.destination, COUNT(*) AS orders, COALESCE(SUM(o.weight_kg),0) AS kg, COALESCE(SUM(o.amount),0) AS revenue
       FROM orders o WHERE o.ctv_id = ? AND ${COUNTED} AND o.received_date >= ? AND o.received_date < ?
       GROUP BY o.destination`,
      [ctvId, from, to]
    ),
  ]);

  const byYm = new Map(t.map((r) => [String(r.ym), r]));
  const trend: CtvStats["trend"] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    const r = byYm.get(key);
    trend.push({ month: key, orders: Number(r?.orders ?? 0), weightKg: Number(r?.kg ?? 0), revenue: Number(r?.revenue ?? 0) });
  }

  // Quốc gia = phần sau dấu phẩy cuối của "Thành phố, Quốc gia".
  const countries = new Map<string, { orders: number; weightKg: number; revenue: number }>();
  for (const r of dest) {
    const parts = String(r.destination ?? "").split(",");
    const country = parts[parts.length - 1].trim() || "Khác";
    const c = countries.get(country) ?? { orders: 0, weightKg: 0, revenue: 0 };
    c.orders += Number(r.orders);
    c.weightKg += Number(r.kg);
    c.revenue += Number(r.revenue);
    countries.set(country, c);
  }

  return {
    period,
    label,
    from,
    to,
    ...cur,
    prev,
    trend,
    byCustomer: cust.map((r) => ({ name: String(r.name), orders: Number(r.orders), weightKg: Number(r.kg), revenue: Number(r.revenue) })),
    byCountry: [...countries.entries()]
      .map(([country, v]) => ({ country, ...v }))
      .sort((a, b) => b.weightKg - a.weightKg || b.orders - a.orders),
  };
}

// ---------- Tài chính ----------

export type CtvFinance = {
  totalRevenue: number; // tổng tiền thu theo đơn (mọi kỳ)
  collectedByCtv: number; // tiền CTV đã thu hộ khách
  remitted: number; // đã nộp lại Falco
  outstanding: number; // còn phải nộp (= đã thu hộ - đã nộp)
  month: string;
  monthRevenue: number;
  statement: {
    falco_code: string;
    received_date: string | null;
    recipient_name: string | null;
    destination: string | null;
    weight_kg: string | null;
    amount: string | null;
    payment_status: PaymentStatus;
    collected_date: string | null;
  }[];
  remittances: { falco_code: string; amount: number; note: string | null; remitted_at: string }[];
};

export async function getCtvFinance(ctvId: number, month: string): Promise<CtvFinance> {
  const m = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const { from, to } = periodRange("month", m);

  const pool = getPool();
  const [[tot], [stmt], [rem]] = await Promise.all([
    pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(o.amount),0) AS revenue,
            COALESCE(SUM(CASE WHEN o.payment_status IN ('collected_by_ctv','paid') AND EXISTS
              (SELECT 1 FROM ctv_remittances r WHERE r.order_id = o.id) THEN o.amount ELSE 0 END),0) AS remitted,
            COALESCE(SUM(CASE WHEN o.payment_status = 'collected_by_ctv' AND NOT EXISTS
              (SELECT 1 FROM ctv_remittances r WHERE r.order_id = o.id) THEN o.amount ELSE 0 END),0) AS outstanding
     FROM orders o WHERE o.ctv_id = ? AND ${COUNTED}`,
    [ctvId]
    ),
    pool.query<RowDataPacket[]>(
    `SELECT o.falco_code, o.received_date, o.recipient_name, o.destination, o.weight_kg, o.amount,
            o.payment_status, o.collected_date
     FROM orders o WHERE o.ctv_id = ? AND ${COUNTED} AND o.received_date >= ? AND o.received_date < ?
     ORDER BY o.received_date, o.id`,
    [ctvId, from, to]
    ),
    pool.query<RowDataPacket[]>(
    `SELECT o.falco_code, r.amount, r.note, r.remitted_at FROM ctv_remittances r
     JOIN orders o ON o.id = r.order_id WHERE r.ctv_id = ? ORDER BY r.remitted_at DESC LIMIT 50`,
    [ctvId]
    ),
  ]);
  const remitted = Number(tot[0].remitted);
  const outstanding = Number(tot[0].outstanding);
  return {
    totalRevenue: Number(tot[0].revenue),
    collectedByCtv: remitted + outstanding,
    remitted,
    outstanding,
    month: m,
    monthRevenue: stmt.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    statement: stmt as CtvFinance["statement"],
    remittances: rem.map((r) => ({
      falco_code: String(r.falco_code),
      amount: Number(r.amount),
      note: r.note ?? null,
      remitted_at: String(r.remitted_at),
    })),
  };
}

// ---------- Tracking Site ----------

import { TRACKING_COLORS as _C, TRACKING_LAYOUTS as _L, type TrackingSiteLayout } from "./tracking-site-config";
export { _C as TRACKING_COLORS, _L as TRACKING_LAYOUTS };
export type { TrackingSiteLayout };

export type TrackingSite = {
  id: number;
  ctv_id: number;
  slug: string;
  display_name: string;
  layout: TrackingSiteLayout;
  color: string;
  custom_color: string | null;
  zalo: string | null;
  whatsapp: string | null;
  facebook: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  has_logo: boolean;
  has_banner: boolean;
  enabled: boolean;
};

const SITE_COLS = `id, ctv_id, slug, display_name, layout, color, custom_color, zalo, whatsapp, facebook, email, phone, address,
  (logo_data IS NOT NULL) AS has_logo, (banner_data IS NOT NULL) AS has_banner, enabled`;

function toSite(r: RowDataPacket): TrackingSite {
  return { ...(r as unknown as TrackingSite), has_logo: !!r.has_logo, has_banner: !!r.has_banner, enabled: !!r.enabled };
}

export async function getTrackingSiteByCtv(ctvId: number): Promise<TrackingSite | null> {
  const [r] = await getPool().query<RowDataPacket[]>(`SELECT ${SITE_COLS} FROM ctv_tracking_sites WHERE ctv_id = ?`, [ctvId]);
  return r[0] ? toSite(r[0]) : null;
}

export async function getTrackingSiteBySlug(slug: string): Promise<TrackingSite | null> {
  const [r] = await getPool().query<RowDataPacket[]>(`SELECT ${SITE_COLS} FROM ctv_tracking_sites WHERE slug = ?`, [slug.toLowerCase()]);
  return r[0] ? toSite(r[0]) : null;
}

// Slug không được gợi tới Falco/đối tác để link công khai không lộ nguồn.
const FORBIDDEN_SLUG = /falco|\bbay|kango|ksn|admin|ctv|api/i;
const RESERVED_SLUGS = new Set(["www", "mail", "smtp", "ftp", "ns1", "ns2", "ns3", "ns4", "webmail", "cpanel", "_"]);

export function validateSlug(slug: string): string | null {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(slug)) return "Tên đường dẫn 3–40 ký tự: chữ thường, số, dấu gạch ngang";
  if (RESERVED_SLUGS.has(slug)) return "Tên đường dẫn này được hệ thống giữ chỗ";
  if (FORBIDDEN_SLUG.test(slug)) return "Tên đường dẫn không được chứa falco, bay, kango, ksn, admin, ctv, api";
  return null;
}

export type SiteInput = {
  slug: string;
  display_name: string;
  layout: TrackingSiteLayout;
  color: string;
  custom_color: string | null;
  zalo: string | null;
  whatsapp: string | null;
  facebook: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  enabled: boolean;
};

export async function upsertTrackingSite(ctvId: number, s: SiteInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const slug = s.slug.toLowerCase().trim();
  const bad = validateSlug(slug);
  if (bad) return { ok: false, error: bad };
  const [taken] = await getPool().query<RowDataPacket[]>("SELECT ctv_id FROM ctv_tracking_sites WHERE slug = ? AND ctv_id <> ?", [slug, ctvId]);
  if (taken.length) return { ok: false, error: "Tên đường dẫn này đã có người dùng" };
  await getPool().query(
    `INSERT INTO ctv_tracking_sites (ctv_id, slug, display_name, layout, color, custom_color, zalo, whatsapp, facebook, email, phone, address, enabled)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE slug=VALUES(slug), display_name=VALUES(display_name), layout=VALUES(layout), color=VALUES(color),
       custom_color=VALUES(custom_color), zalo=VALUES(zalo), whatsapp=VALUES(whatsapp), facebook=VALUES(facebook),
       email=VALUES(email), phone=VALUES(phone), address=VALUES(address), enabled=VALUES(enabled)`,
    [ctvId, slug, s.display_name, s.layout, s.color, s.custom_color, s.zalo, s.whatsapp, s.facebook, s.email, s.phone, s.address, s.enabled ? 1 : 0]
  );
  return { ok: true };
}

export async function setTrackingSiteImage(ctvId: number, kind: "logo" | "banner", data: Buffer | null, type: string | null) {
  const col = kind === "logo" ? "logo" : "banner";
  await getPool().query(`UPDATE ctv_tracking_sites SET ${col}_data = ?, ${col}_type = ? WHERE ctv_id = ?`, [data, type, ctvId]);
}

export async function getTrackingSiteImage(slug: string, kind: "logo" | "banner"): Promise<{ data: Buffer; type: string } | null> {
  const col = kind === "logo" ? "logo" : "banner";
  const [r] = await getPool().query<RowDataPacket[]>(
    `SELECT ${col}_data AS data, ${col}_type AS type FROM ctv_tracking_sites WHERE slug = ? AND enabled = 1`,
    [slug.toLowerCase()]
  );
  return r[0]?.data ? { data: r[0].data as Buffer, type: String(r[0].type || "image/png") } : null;
}

// ---------- Admin: gán đơn cho CTV ----------

/** Gán (hoặc bỏ gán khi ctvId = null) nhiều đơn cho 1 CTV. Trả số đơn đã đổi. Đơn CTV tự tạo đang chờ duyệt không bị đổi chủ. */
export async function assignOrdersToCtv(orderIds: number[], ctvId: number | null): Promise<number> {
  const ids = [...new Set(orderIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (!ids.length) return 0;
  const [r] = await getPool().query(
    `UPDATE orders SET ctv_id = ? WHERE id IN (?) AND review_status NOT IN ('pending','rejected')`,
    [ctvId, ids]
  );
  return (r as { affectedRows: number }).affectedRows;
}
