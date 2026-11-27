import mysql from "mysql2/promise";
import dns from "node:dns";
import type { ParsedCategory } from "./price-quote-import";
import type { ShipmentStatus } from "./shipment-status";
import { toIsoDateLocal, vnDateString } from "./vn-date";

// Máy dev nối DB_HOST dạng tên miền WAN (vd đang phát triển từ máy cá nhân)
// có lúc bị resolve ra địa chỉ IPv6 không nằm trong danh sách IP được phép
// truy cập từ xa của Hostinger, gây lỗi "Access denied" dù mật khẩu đúng.
// Production dùng DB_HOST=localhost nên không bị ảnh hưởng — chỉ set để an
// toàn hơn cho môi trường dev.
dns.setDefaultResultOrder("ipv4first");

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
      throw new Error(
        "Thiếu biến môi trường DB_HOST/DB_USER/DB_PASSWORD/DB_NAME"
      );
    }
    pool = mysql.createPool({
      host: DB_HOST,
      port: Number(DB_PORT) || 3306,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      // Hostinger giới hạn 500 kết nối MỚI/giờ cho user DB (dùng chung web + cron + script).
      // Giữ pool nhỏ và giữ kết nối rảnh 5 phút (mặc định mysql2 đóng sau 60s → mỗi lần
      // mở trang lại tạo kết nối mới). Trên server DB ở cạnh nên 5 kết nối là đủ nhanh.
      connectionLimit: 5,
      maxIdle: 5,
      idleTimeout: 5 * 60 * 1000,
      queueLimit: 0,
      // Giữ kết nối sống qua TCP keepalive — tránh lỗi "write EPIPE" khi kết
      // nối bị firewall/NAT âm thầm đóng sau một thời gian không hoạt động
      // (hay gặp khi app kết nối MySQL qua WAN, vd chạy dev từ máy cá nhân).
      // Trả cột DATE dưới dạng chuỗi "YYYY-MM-DD" bất biến với mọi múi giờ tiến trình Node.
      dateStrings: ["DATE"],
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
    });
  }
  return pool;
}

// Tự thêm cột mới vào bảng orders khi web chạy lần đầu sau khi cập nhật (idempotent, chạy 1 lần mỗi tiến trình).
let schemaReady: Promise<void> | null = null;
export function ensureOrdersSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const [cols] = await getPool().query("SHOW COLUMNS FROM orders LIKE 'recipient_postcode'");
      if ((cols as unknown[]).length === 0) {
        await getPool().query("ALTER TABLE orders ADD COLUMN recipient_postcode VARCHAR(20) NULL AFTER recipient_phone");
      }
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// Tự tạo bảng ảnh kiện + cột ghi chú cho khách của bill Kango khi web chạy lần đầu sau khi cập nhật
// (idempotent, 1 lần mỗi tiến trình) — MySQL Hostinger chặn kết nối từ máy ngoài nên không chạy script tay được.
let kangoBillSchemaReady: Promise<void> | null = null;
export function ensureKangoBillSchema(): Promise<void> {
  if (!kangoBillSchemaReady) {
    kangoBillSchemaReady = (async () => {
      const [cols] = await getPool().query("SHOW COLUMNS FROM kango_bills LIKE 'customer_note'");
      if ((cols as unknown[]).length === 0) {
        await getPool().query("ALTER TABLE kango_bills ADD COLUMN customer_note TEXT NULL");
      }
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS kango_bill_images (
          id INT AUTO_INCREMENT PRIMARY KEY,
          bill_id INT NOT NULL,
          filename VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          file_size INT NOT NULL,
          data LONGBLOB NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_kango_bill_images_bill_id (bill_id),
          FOREIGN KEY (bill_id) REFERENCES kango_bills(id) ON DELETE CASCADE
        )
      `);
    })().catch((err) => {
      kangoBillSchemaReady = null;
      throw err;
    });
  }
  return kangoBillSchemaReady;
}

export type PaymentStatus = "unpaid" | "collected_by_staff" | "collected_by_ctv" | "paid";
export type OrderSource = "staff" | "ctv";
export type OrderReviewStatus = "auto_approved" | "pending" | "approved" | "rejected";

export type OrderRecord = {
  id: number;
  falco_code: string;
  awb: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_postcode: string | null; // mã bưu chính người nhận — chỉ dùng nội bộ (tra DPD/DHL), không công khai
  service: string | null;
  destination: string | null;
  received_date: string | null;
  payment_status: PaymentStatus;
  collected_date: string | null; // ngày thu tiền khách (DATE) — xem updateOrder
  amount: string | null;
  cost: string | null;
  chi_source_invoice: string | null;
  weight_kg: string | null;
  source: OrderSource;
  ctv_id: number | null;
  review_status: OrderReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function findOrderByFalcoCode(
  falcoCode: string
): Promise<OrderRecord | null> {
  const [rows] = await getPool().query(
    "SELECT * FROM orders WHERE falco_code = ? LIMIT 1",
    [falcoCode.trim().toUpperCase()]
  );
  const list = rows as OrderRecord[];
  return list[0] ?? null;
}

export async function findOrderById(id: number): Promise<OrderRecord | null> {
  const [rows] = await getPool().query("SELECT * FROM orders WHERE id = ? LIMIT 1", [id]);
  const list = rows as OrderRecord[];
  return list[0] ?? null;
}

/** Tra nhiều đơn theo AWB trong 1 truy vấn: Map awb → đơn. */
export async function findOrdersByAwbs(awbs: string[]): Promise<Map<string, OrderRecord>> {
  const list = [...new Set(awbs.map((a) => a.trim()).filter(Boolean))];
  const map = new Map<string, OrderRecord>();
  if (!list.length) return map;
  const [rows] = await getPool().query("SELECT * FROM orders WHERE awb IN (?)", [list]);
  for (const o of rows as OrderRecord[]) map.set(o.awb, o);
  return map;
}

/** Mã tracking đã có của nhiều đơn trong 1 truy vấn: Map orderId → Set mã. */
export async function listTrackingCodesByOrders(orderIds: number[]): Promise<Map<number, Set<string>>> {
  const map = new Map<number, Set<string>>();
  if (!orderIds.length) return map;
  const [rows] = await getPool().query("SELECT order_id, tracking_code FROM order_parcels WHERE order_id IN (?)", [orderIds]);
  for (const r of rows as { order_id: number; tracking_code: string }[]) {
    if (!map.has(r.order_id)) map.set(r.order_id, new Set());
    map.get(r.order_id)!.add(r.tracking_code);
  }
  return map;
}

export async function findOrderByAwb(
  awb: string
): Promise<OrderRecord | null> {
  const [rows] = await getPool().query(
    "SELECT * FROM orders WHERE awb = ? LIMIT 1",
    [awb.trim()]
  );
  const list = rows as OrderRecord[];
  return list[0] ?? null;
}

export type NewOrder = {
  falcoCode: string;
  awb: string;
  recipientName: string;
  recipientPhone: string;
  recipientPostcode?: string | null;
  service: string;
  destination: string;
  receivedDate: string | null; // "YYYY-MM-DD" or null
  weightKg?: number | null;
  amount?: number | null;
  cost?: number | null;
  source?: OrderSource;
  ctvId?: number | null;
  reviewStatus?: OrderReviewStatus;
};

export type NewAutoCodedOrder = Omit<NewOrder, "falcoCode" | "awb"> & {
  awb?: string;
};

export async function insertOrder(order: NewOrder): Promise<number> {
  await ensureOrdersSchema();
  const [result] = await getPool().query(
    `INSERT INTO orders
      (falco_code, awb, recipient_name, recipient_phone, recipient_postcode, service, destination, received_date,
       weight_kg, amount, cost, source, ctv_id, review_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.falcoCode,
      order.awb,
      order.recipientName,
      order.recipientPhone,
      order.recipientPostcode?.trim() || null,
      order.service,
      order.destination,
      order.receivedDate,
      order.weightKg ?? null,
      order.amount ?? null,
      order.cost ?? null,
      order.source ?? "staff",
      order.ctvId ?? null,
      order.reviewStatus ?? "auto_approved",
    ]
  );
  monthsCache = null;
  return (result as mysql.ResultSetHeader).insertId;
}

/**
 * Sinh mã Falco hôm nay theo giờ Việt Nam (FLyyMMddNNN) và chèn đơn + danh sách
 * kiện trong cùng 1 transaction có khoá (GET_LOCK + SELECT ... FOR UPDATE + retry
 * khi trùng unique) — chống trùng mã khi nhiều người tạo/upload cùng lúc và không
 * nạp cả bảng orders lên RAM.
 */
export async function insertOrderWithGeneratedFalcoCode(
  order: NewAutoCodedOrder,
  parcels: { hawb: string; trackingCode: string }[] = []
): Promise<{ id: number; falcoCode: string }> {
  await ensureOrdersSchema();
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ymd = vnDateString();
    const prefix = `FL${ymd.slice(2, 4)}${ymd.slice(5, 7)}${ymd.slice(8, 10)}`;
    const lockName = `falco_code_${prefix}`;
    const conn = await getPool().getConnection();
    let lockAcquired = false;

    try {
      const [lockRows] = await conn.query("SELECT GET_LOCK(?, 10) AS locked", [lockName]);
      lockAcquired = Number((lockRows as { locked: number | null }[])[0]?.locked ?? 0) === 1;

      await conn.beginTransaction();
      const [codeRows] = await conn.query(
        "SELECT falco_code FROM orders WHERE falco_code LIKE ? FOR UPDATE",
        [`${prefix}%`]
      );
      const existing = new Set<string>();
      let maxSeq = 0;
      for (const r of codeRows as { falco_code: string }[]) {
        const upper = r.falco_code.toUpperCase();
        existing.add(upper);
        const suffix = upper.slice(prefix.length);
        if (/^\d+$/.test(suffix)) {
          const n = Number(suffix);
          if (n > maxSeq) maxSeq = n;
        }
      }

      let seq = maxSeq + 1;
      let falcoCode = `${prefix}${String(seq).padStart(3, "0")}`;
      while (existing.has(falcoCode)) {
        seq += 1;
        falcoCode = `${prefix}${String(seq).padStart(3, "0")}`;
      }

      const awb = order.awb && order.awb.trim() ? order.awb.trim() : falcoCode;
      const [result] = await conn.query(
        `INSERT INTO orders
          (falco_code, awb, recipient_name, recipient_phone, recipient_postcode, service, destination, received_date,
           weight_kg, amount, cost, source, ctv_id, review_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          falcoCode,
          awb,
          order.recipientName,
          order.recipientPhone,
          order.recipientPostcode?.trim() || null,
          order.service,
          order.destination,
          order.receivedDate,
          order.weightKg ?? null,
          order.amount ?? null,
          order.cost ?? null,
          order.source ?? "staff",
          order.ctvId ?? null,
          order.reviewStatus ?? "auto_approved",
        ]
      );
      const orderId = (result as mysql.ResultSetHeader).insertId;

      const cleanParcels = parcels
        .map((p) => ({ hawb: (p.hawb ?? "").trim(), trackingCode: p.trackingCode.trim() }))
        .filter((p) => p.trackingCode.length > 0);
      if (cleanParcels.length > 0) {
        await conn.query(
          "INSERT INTO order_parcels (order_id, hawb, tracking_code) VALUES ?",
          [cleanParcels.map((p) => [orderId, p.hawb, p.trackingCode])]
        );
      }

      await conn.commit();
      monthsCache = null;
      return { id: orderId, falcoCode };
    } catch (err) {
      await conn.rollback().catch(() => {});
      const code = (err as { code?: string })?.code;
      if (code === "ER_DUP_ENTRY" && attempt < maxAttempts - 1) {
        continue;
      }
      throw err;
    } finally {
      if (lockAcquired) {
        await conn.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
      }
      conn.release();
    }
  }

  throw new Error("Không thể sinh mã Falco duy nhất sau nhiều lần thử");
}

/** Cập nhật tên dịch vụ của đơn (đồng bộ vận đơn đối tác chuẩn hoá lại tên). */
export async function setOrderService(orderId: number, service: string): Promise<void> {
  await getPool().query("UPDATE orders SET service = ? WHERE id = ? AND (service IS NULL OR service <> ?)", [service, orderId, service]);
}

/** Đơn FEB… lấy dữ liệu theo vận đơn Bay: ghi đè người nhận/SĐT/điểm đến/cân nặng bằng giá trị Bay khi Bay có (không xoá khi Bay để trống). */
export async function fillOrderBlanks(
  orderId: number,
  f: { recipientName?: string; recipientPhone?: string; recipientPostcode?: string; destination?: string; weightKg?: number | null }
): Promise<void> {
  await ensureOrdersSchema();
  await getPool().query(
    `UPDATE orders SET
       recipient_name = IF(? <> '', ?, recipient_name),
       recipient_phone = IF(? <> '', ?, recipient_phone),
       recipient_postcode = IF(? <> '', ?, recipient_postcode),
       destination = IF(? <> '', ?, destination),
       weight_kg = IF(? IS NOT NULL, ?, weight_kg)
     WHERE id = ?`,
    [
      f.recipientName ?? "", f.recipientName ?? "",
      f.recipientPhone ?? "", f.recipientPhone ?? "",
      f.recipientPostcode ?? "", f.recipientPostcode ?? "",
      f.destination ?? "", f.destination ?? "",
      f.weightKg ?? null, f.weightKg ?? null,
      orderId,
    ]
  );
}

/** Thêm mã tracking cho đơn nếu chưa có (dùng khi đồng bộ vận đơn BayOnline gán nhãn muộn). */
export async function syncOrderParcel(orderId: number, hawb: string, trackingCode: string): Promise<void> {
  const [rows] = await getPool().query(
    "SELECT id FROM order_parcels WHERE order_id = ? AND tracking_code = ? LIMIT 1",
    [orderId, trackingCode]
  );
  if ((rows as unknown[]).length === 0) await insertParcels(orderId, [{ hawb, trackingCode }]);
}

export async function insertParcels(
  orderId: number,
  parcels: { hawb: string; trackingCode: string }[]
): Promise<void> {
  if (parcels.length === 0) return;
  const values = parcels.map((p) => [orderId, p.hawb, p.trackingCode]);
  await getPool().query(
    "INSERT INTO order_parcels (order_id, hawb, tracking_code) VALUES ?",
    [values]
  );
}

export type OrderParcel = { id: number; hawb: string; tracking_code: string };

export async function listOrderParcels(orderId: number): Promise<OrderParcel[]> {
  const [rows] = await getPool().query(
    "SELECT id, hawb, tracking_code FROM order_parcels WHERE order_id = ? ORDER BY id",
    [orderId]
  );
  return rows as OrderParcel[];
}

export type ParcelInput = string | { hawb?: string; trackingCode: string };

async function replaceOrderParcelsOnConn(
  conn: mysql.PoolConnection,
  orderId: number,
  parcels: ParcelInput[]
): Promise<void> {
  await conn.query("DELETE FROM order_parcels WHERE order_id = ?", [orderId]);
  const normalized = parcels
    .map((item) =>
      typeof item === "string"
        ? { hawb: "", trackingCode: item.trim() }
        : { hawb: (item.hawb ?? "").trim(), trackingCode: item.trackingCode.trim() }
    )
    .filter((p) => p.trackingCode.length > 0);
  if (normalized.length === 0) return;
  const values = normalized.map((p) => [orderId, p.hawb, p.trackingCode]);
  await conn.query(
    "INSERT INTO order_parcels (order_id, hawb, tracking_code) VALUES ?",
    [values]
  );
}

/** Thay toàn bộ danh sách kiện của 1 đơn trong 1 transaction — tránh mất kiện nếu INSERT lỗi. */
export async function replaceOrderParcels(
  orderId: number,
  trackingCodes: ParcelInput[]
): Promise<void> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await replaceOrderParcelsOnConn(conn, orderId, trackingCodes);
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

export type OrderEditableFields = Partial<{
  awb: string;
  recipientName: string;
  recipientPhone: string;
  recipientPostcode: string | null;
  service: string;
  destination: string;
  receivedDate: string | null;
  paymentStatus: PaymentStatus;
  collectedDate: string | null;
  amount: number | null;
  cost: number | null;
  chiSourceInvoice: string | null;
  weightKg: number | null;
}>;

const ORDER_FIELD_COLUMNS: Record<keyof OrderEditableFields, string> = {
  awb: "awb",
  recipientName: "recipient_name",
  recipientPhone: "recipient_phone",
  recipientPostcode: "recipient_postcode",
  service: "service",
  destination: "destination",
  receivedDate: "received_date",
  paymentStatus: "payment_status",
  collectedDate: "collected_date",
  amount: "amount",
  cost: "cost",
  chiSourceInvoice: "chi_source_invoice",
  weightKg: "weight_kg",
};

function buildOrderUpdateParts(fields: OrderEditableFields): { setClause: string; values: unknown[] } | null {
  const entries = Object.entries(fields) as [keyof OrderEditableFields, unknown][];
  if (entries.length === 0) return null;
  const assignments = entries.map(([key]) => `${ORDER_FIELD_COLUMNS[key]} = ?`);
  const values = entries.map(([, value]) => value);
  // Đổi trạng thái thu mà không chỉ định ngày thu: sang "chưa thu" thì xoá
  // ngày thu; sang các trạng thái đã thu thì điền hôm nay (giờ VN, tính ở
  // Node) nếu chưa có — giữ ngày thu ĐẦU TIÊN khi chuyển Thu hộ → Đã thu.
  if (fields.paymentStatus !== undefined && !("collectedDate" in fields)) {
    if (fields.paymentStatus === "unpaid") {
      assignments.push("collected_date = NULL");
    } else {
      assignments.push("collected_date = COALESCE(collected_date, ?)");
      values.push(vnDateString());
    }
  }
  return { setClause: assignments.join(", "), values };
}

export async function updateOrder(
  id: number,
  fields: OrderEditableFields
): Promise<boolean> {
  const parts = buildOrderUpdateParts(fields);
  if (!parts) return false;
  await ensureOrdersSchema();
  const [result] = await getPool().query(
    `UPDATE orders SET ${parts.setClause} WHERE id = ?`,
    [...parts.values, id]
  );
  monthsCache = null;
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

/**
 * Sửa đơn + kiện + ghi lịch sử hoàn tác trong CÙNG 1 transaction — đảm bảo
 * không tạo lịch sử "ma" khi UPDATE lỗi và không mất kiện khi thay danh sách tracking.
 */
export async function updateOrderWithHistoryTx(params: {
  orderId: number;
  fields: OrderEditableFields;
  trackingCodes?: string[];
  changedBy: string;
}): Promise<{ found: boolean }> {
  await ensureOrdersSchema();
  const willChangeFields = Object.keys(params.fields).length > 0;
  const willChangeParcels = Array.isArray(params.trackingCodes);

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [orderRows] = await conn.query("SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [params.orderId]);
    const order = (orderRows as OrderRecord[])[0];
    if (!order) {
      await conn.rollback();
      return { found: false };
    }

    if (!willChangeFields && !willChangeParcels) {
      await conn.commit();
      return { found: true };
    }

    const [parcelRows] = await conn.query(
      "SELECT id, hawb, tracking_code FROM order_parcels WHERE order_id = ? ORDER BY id FOR UPDATE",
      [params.orderId]
    );
    const currentParcels = parcelRows as OrderParcel[];

    await conn.query(
      `INSERT INTO order_edit_history (order_id, action, before_data, changed_by)
       VALUES (?, 'update', ?, ?)`,
      [
        params.orderId,
        JSON.stringify({
          order,
          trackingCodes: currentParcels.map((p) => p.tracking_code),
          parcels: currentParcels.map((p) => ({ hawb: p.hawb, trackingCode: p.tracking_code })),
        }),
        params.changedBy,
      ]
    );

    if (willChangeFields) {
      const parts = buildOrderUpdateParts(params.fields);
      if (parts) {
        await conn.query(`UPDATE orders SET ${parts.setClause} WHERE id = ?`, [...parts.values, params.orderId]);
      }
    }

    if (willChangeParcels && params.trackingCodes) {
      // Giữ lại hawb của các mã tracking đã có trước đó để không mất thông tin HAWB khi sửa đơn.
      const hawbByTracking = new Map<string, string>();
      for (const p of currentParcels) {
        if (p.hawb && !hawbByTracking.has(p.tracking_code)) {
          hawbByTracking.set(p.tracking_code, p.hawb);
        }
      }
      const nextParcels = params.trackingCodes
        .map((raw) => raw.trim())
        .filter(Boolean)
        .map((code) => ({ hawb: hawbByTracking.get(code) ?? "", trackingCode: code }));
      await replaceOrderParcelsOnConn(conn, params.orderId, nextParcels);
    }

    await conn.commit();
    monthsCache = null;
    return { found: true };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** Xoá đơn + ghi snapshot đầy đủ vào order_edit_history trong cùng 1 transaction. */
export async function deleteOrderWithHistoryTx(params: {
  orderId: number;
  changedBy: string;
}): Promise<boolean> {
  await ensureOrdersSchema();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [orderRows] = await conn.query("SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [params.orderId]);
    const order = (orderRows as OrderRecord[])[0];
    if (!order) {
      await conn.rollback();
      return false;
    }

    const [parcelRows] = await conn.query(
      "SELECT id, hawb, tracking_code FROM order_parcels WHERE order_id = ? ORDER BY id FOR UPDATE",
      [params.orderId]
    );
    const parcels = parcelRows as OrderParcel[];

    await conn.query(
      `INSERT INTO order_edit_history (order_id, action, before_data, changed_by)
       VALUES (?, 'delete', ?, ?)`,
      [
        params.orderId,
        JSON.stringify({
          order,
          trackingCodes: parcels.map((p) => p.tracking_code),
          parcels: parcels.map((p) => ({ hawb: p.hawb, trackingCode: p.tracking_code })),
        }),
        params.changedBy,
      ]
    );

    const [result] = await conn.query("DELETE FROM orders WHERE id = ?", [params.orderId]);
    await conn.commit();
    monthsCache = null;
    return (result as mysql.ResultSetHeader).affectedRows > 0;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteOrder(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM orders WHERE id = ?", [id]);
  monthsCache = null;
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

/** Duyệt 1 đơn do FWD tạo — chỉ tác dụng khi đơn đang "chờ duyệt". */
export async function approveOrder(id: number, adminEmail: string): Promise<boolean> {
  const [result] = await getPool().query(
    `UPDATE orders SET review_status = 'approved', reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ? AND review_status = 'pending'`,
    [adminEmail, id]
  );
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export async function rejectOrder(id: number, adminEmail: string): Promise<boolean> {
  const [result] = await getPool().query(
    `UPDATE orders SET review_status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ? AND review_status = 'pending'`,
    [adminEmail, id]
  );
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

/** Danh sách các tháng (YYYY-MM) có đơn, mới nhất trước — dùng cho bộ lọc tháng. */
let monthsCache: { at: number; v: string[] } | null = null;
export async function listOrderMonths(): Promise<string[]> {
  if (monthsCache && Date.now() - monthsCache.at < 60_000) return monthsCache.v;
  const v = await queryOrderMonths();
  monthsCache = { at: Date.now(), v };
  return v;
}
async function queryOrderMonths(): Promise<string[]> {
  const [rows] = await getPool().query(
    `SELECT DISTINCT DATE_FORMAT(received_date, '%Y-%m') AS month
     FROM orders WHERE received_date IS NOT NULL
     ORDER BY month DESC`
  );
  return (rows as { month: string }[]).map((r) => r.month);
}

export async function listAwbSet(): Promise<Set<string>> {
  const [rows] = await getPool().query("SELECT awb FROM orders");
  return new Set((rows as { awb: string }[]).map((r) => r.awb.toUpperCase()));
}

export async function listFalcoCodeSet(prefix?: string): Promise<Set<string>> {
  const [rows] = prefix
    ? await getPool().query("SELECT falco_code FROM orders WHERE falco_code LIKE ?", [`${prefix}%`])
    : await getPool().query("SELECT falco_code FROM orders");
  return new Set(
    (rows as { falco_code: string }[]).map((r) => r.falco_code.toUpperCase())
  );
}

// ---------- Admin: người dùng quản trị ----------

export type AdminRole = "owner" | "staff";

export type AdminUser = {
  id: number;
  email: string;
  password_hash: string;
  role: AdminRole;
};

export async function findAdminByEmail(
  email: string
): Promise<AdminUser | null> {
  const [rows] = await getPool().query(
    "SELECT * FROM admin_users WHERE email = ? LIMIT 1",
    [email.trim().toLowerCase()]
  );
  const list = rows as AdminUser[];
  return list[0] ?? null;
}

export type AdminUserListItem = { id: number; email: string; role: AdminRole; created_at: string };

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  const [rows] = await getPool().query(
    "SELECT id, email, role, created_at FROM admin_users ORDER BY id ASC"
  );
  return rows as AdminUserListItem[];
}

export async function insertAdminUser(
  email: string,
  passwordHash: string,
  role: AdminRole
): Promise<number> {
  const [result] = await getPool().query(
    "INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)",
    [email.trim().toLowerCase(), passwordHash, role]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

export async function deleteAdminUser(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM admin_users WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

// ---------- FWD: tài khoản FWD ----------

export type CtvStatus = "active" | "disabled";

export type CtvUser = {
  id: number;
  email: string;
  password_hash: string;
  ctv_code: string;
  full_name: string;
  phone: string;
  cccd_number: string;
  referred_by_ctv_id: number | null;
  commission_pct: string;
  referral_override_pct: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_zalo_href: string | null;
  status: CtvStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function findCtvByEmail(email: string): Promise<CtvUser | null> {
  const [rows] = await getPool().query(
    "SELECT * FROM ctv_users WHERE email = ? LIMIT 1",
    [email.trim().toLowerCase()]
  );
  const list = rows as CtvUser[];
  return list[0] ?? null;
}

export async function findCtvById(id: number): Promise<CtvUser | null> {
  const [rows] = await getPool().query("SELECT * FROM ctv_users WHERE id = ? LIMIT 1", [id]);
  const list = rows as CtvUser[];
  return list[0] ?? null;
}

export type CtvUserListItem = {
  id: number;
  ctv_code: string;
  full_name: string;
  phone: string;
  status: CtvStatus;
  referred_by_ctv_id: number | null;
  referred_by_name: string | null;
  created_at: string;
};

/** Danh sách FWD cho tab "Quản lý FWD" — kèm tên người giới thiệu (nếu có). */
export async function listCtvUsers(): Promise<CtvUserListItem[]> {
  const [rows] = await getPool().query(
    `SELECT c.id, c.ctv_code, c.full_name, c.phone, c.status, c.referred_by_ctv_id,
            r.full_name AS referred_by_name, c.created_at
     FROM ctv_users c
     LEFT JOIN ctv_users r ON r.id = c.referred_by_ctv_id
     ORDER BY c.id ASC`
  );
  return rows as CtvUserListItem[];
}

export type NewCtvUser = {
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  cccdNumber: string;
  referredByCtvId: number | null;
  commissionPct: number;
  referralOverridePct: number;
  createdBy: string;
};

/**
 * ctv_code ("mã riêng") được sinh từ chính id sau khi insert (FWD-0001,
 * FWD-0002, ...) — luôn duy nhất vì id là AUTO_INCREMENT, không cần khoá
 * bảng hay đếm số dòng hiện có (tránh trùng nếu có dòng đã bị xoá).
 */
export async function insertCtvUser(
  data: NewCtvUser
): Promise<{ id: number; ctvCode: string }> {
  const [result] = await getPool().query(
    `INSERT INTO ctv_users
      (email, password_hash, ctv_code, full_name, phone, cccd_number, referred_by_ctv_id, commission_pct, referral_override_pct, created_by)
     VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.email.trim().toLowerCase(),
      data.passwordHash,
      data.fullName.trim(),
      data.phone.trim(),
      data.cccdNumber.trim(),
      data.referredByCtvId,
      data.commissionPct,
      data.referralOverridePct,
      data.createdBy,
    ]
  );
  const id = (result as mysql.ResultSetHeader).insertId;
  const ctvCode = `FWD-${String(id).padStart(4, "0")}`;
  await getPool().query("UPDATE ctv_users SET ctv_code = ? WHERE id = ?", [ctvCode, id]);
  return { id, ctvCode };
}

export type CtvEditableFields = Partial<{
  fullName: string;
  phone: string;
  cccdNumber: string;
  status: CtvStatus;
  commissionPct: number;
  referralOverridePct: number;
  contactName: string | null;
  contactPhone: string | null;
  contactZaloHref: string | null;
}>;

const CTV_FIELD_COLUMNS: Record<keyof CtvEditableFields, string> = {
  fullName: "full_name",
  phone: "phone",
  cccdNumber: "cccd_number",
  status: "status",
  commissionPct: "commission_pct",
  referralOverridePct: "referral_override_pct",
  contactName: "contact_name",
  contactPhone: "contact_phone",
  contactZaloHref: "contact_zalo_href",
};

/**
 * Dùng chung cho cả admin sửa hồ sơ FWD (mọi field) lẫn FWD tự sửa liên hệ
 * hiển thị trên bảng giá (chỉ contact*) — giới hạn field nào được sửa nằm ở
 * route handler gọi hàm này, không phải ở đây.
 */
export async function updateCtvUser(id: number, fields: CtvEditableFields): Promise<boolean> {
  // Bỏ trường undefined (vd nút bật/tắt chỉ gửi status) — nếu không sẽ ghi NULL đè lên hồ sơ FWD.
  const entries = (Object.entries(fields) as [keyof CtvEditableFields, unknown][]).filter(
    ([key, value]) => value !== undefined && key in CTV_FIELD_COLUMNS
  );
  if (entries.length === 0) return false;
  const setClause = entries.map(([key]) => `${CTV_FIELD_COLUMNS[key]} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  const [result] = await getPool().query(
    `UPDATE ctv_users SET ${setClause} WHERE id = ?`,
    [...values, id]
  );
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export async function deleteCtvUser(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM ctv_users WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

// ---------- FWD: nội dung hướng dẫn + nhóm/kênh (admin quản lý, FWD chỉ xem) ----------

export type CtvContentKind = "guide" | "channel";

export type CtvContentItem = {
  id: number;
  kind: CtvContentKind;
  title: string;
  content: string;
  position: number;
};

export async function listCtvContentItems(kind: CtvContentKind): Promise<CtvContentItem[]> {
  const [rows] = await getPool().query(
    "SELECT id, kind, title, content, position FROM ctv_content_items WHERE kind = ? ORDER BY position ASC, id ASC",
    [kind]
  );
  return rows as CtvContentItem[];
}

export async function insertCtvContentItem(
  kind: CtvContentKind,
  title: string,
  content: string
): Promise<number> {
  const [result] = await getPool().query(
    "INSERT INTO ctv_content_items (kind, title, content) VALUES (?, ?, ?)",
    [kind, title, content]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

export async function updateCtvContentItem(
  id: number,
  fields: Partial<{ title: string; content: string; position: number }>
): Promise<boolean> {
  // Chỉ nhận đúng 3 cột cho phép và bỏ undefined (tránh ghi NULL / tên cột lạ vào SQL).
  const allowed = new Set(["title", "content", "position"]);
  const entries = (Object.entries(fields) as [keyof typeof fields, unknown][]).filter(
    ([key, value]) => value !== undefined && allowed.has(key)
  );
  if (entries.length === 0) return false;
  const setClause = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  const [result] = await getPool().query(
    `UPDATE ctv_content_items SET ${setClause} WHERE id = ?`,
    [...values, id]
  );
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export async function deleteCtvContentItem(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM ctv_content_items WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

// ---------- FWD: hoa hồng + công nợ ----------

export type CtvCommissionSummary = {
  baseRevenue: number;
  baseCommission: number;
  overrideRevenue: number;
  overrideCommission: number;
  totalAccrued: number;
  totalPaid: number;
  balance: number;
};

/**
 * Tính ĐỘNG từ orders + ctv_users mỗi lần gọi (không có "sổ hoa hồng" lưu
 * sẵn) — xem ghi chú trong ctv_payouts DDL (scripts/setup-ctv-tables.ts) về
 * lý do chọn cách này. Chỉ đơn `review_status = 'approved'` mới tính.
 */
export async function getCtvCommissionSummary(ctvId: number): Promise<CtvCommissionSummary> {
  const empty: CtvCommissionSummary = {
    baseRevenue: 0,
    baseCommission: 0,
    overrideRevenue: 0,
    overrideCommission: 0,
    totalAccrued: 0,
    totalPaid: 0,
    balance: 0,
  };
  const ctv = await findCtvById(ctvId);
  if (!ctv) return empty;

  const commissionPct = Number(ctv.commission_pct);
  const overridePct = Number(ctv.referral_override_pct);

  const [baseRows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM orders WHERE ctv_id = ? AND review_status = 'approved'`,
    [ctvId]
  );
  const baseRevenue = Number((baseRows as { total: string }[])[0]?.total ?? 0);

  const [overrideRows] = await getPool().query(
    `SELECT COALESCE(SUM(o.amount), 0) AS total
     FROM orders o
     JOIN ctv_users downline ON downline.id = o.ctv_id
     WHERE downline.referred_by_ctv_id = ? AND o.review_status = 'approved'`,
    [ctvId]
  );
  const overrideRevenue = Number((overrideRows as { total: string }[])[0]?.total ?? 0);

  const [paidRows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM ctv_payouts WHERE ctv_id = ?`,
    [ctvId]
  );
  const totalPaid = Number((paidRows as { total: string }[])[0]?.total ?? 0);

  const baseCommission = baseRevenue * (commissionPct / 100);
  const overrideCommission = overrideRevenue * (overridePct / 100);
  const totalAccrued = baseCommission + overrideCommission;

  return {
    baseRevenue,
    baseCommission,
    overrideRevenue,
    overrideCommission,
    totalAccrued,
    totalPaid,
    balance: totalAccrued - totalPaid,
  };
}

export type CtvDestinationStat = {
  destination: string | null;
  revenue: number;
  weightKg: number;
  orderCount: number;
};

/** "Thống kê doanh thu + sản lượng (kg)" của 1 FWD, chia theo destination — chỉ tính đơn đã duyệt. */
export async function getCtvRevenueStats(ctvId: number): Promise<CtvDestinationStat[]> {
  const [rows] = await getPool().query(
    `SELECT destination, COALESCE(SUM(amount), 0) AS revenue, COALESCE(SUM(weight_kg), 0) AS weightKg, COUNT(*) AS orderCount
     FROM orders
     WHERE ctv_id = ? AND review_status = 'approved'
     GROUP BY destination
     ORDER BY revenue DESC`,
    [ctvId]
  );
  return (rows as { destination: string | null; revenue: string; weightKg: string; orderCount: number }[]).map(
    (r) => ({
      destination: r.destination,
      revenue: Number(r.revenue),
      weightKg: Number(r.weightKg),
      orderCount: r.orderCount,
    })
  );
}

export type CtvPayableRow = CtvCommissionSummary & { ctvId: number; ctvCode: string; fullName: string };

/** Sổ công nợ (chiều Falco nợ FWD) cho tab "Công nợ" ở admin — 1 dòng / FWD. */
export async function listCtvPayables(): Promise<CtvPayableRow[]> {
  const ctvs = await listCtvUsers();
  const rows: CtvPayableRow[] = [];
  for (const c of ctvs) {
    const summary = await getCtvCommissionSummary(c.id);
    rows.push({ ctvId: c.id, ctvCode: c.ctv_code, fullName: c.full_name, ...summary });
  }
  return rows;
}

export async function insertCtvPayout(data: {
  ctvId: number;
  amount: number;
  note: string | null;
  paidBy: string;
}): Promise<number> {
  const [result] = await getPool().query(
    "INSERT INTO ctv_payouts (ctv_id, amount, note, paid_by) VALUES (?, ?, ?, ?)",
    [data.ctvId, data.amount, data.note, data.paidBy]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

export type OutstandingCollection = {
  orderId: number;
  falcoCode: string;
  ctvId: number;
  ctvCode: string;
  ctvFullName: string;
  amount: string | null;
};

/** Đơn FWD thu hộ khách nhưng CHƯA xác nhận nộp lại cho Falco (chiều FWD nợ Falco). */
export async function listOutstandingCtvCollections(): Promise<OutstandingCollection[]> {
  const [rows] = await getPool().query(
    `SELECT o.id AS orderId, o.falco_code AS falcoCode, o.ctv_id AS ctvId,
            c.ctv_code AS ctvCode, c.full_name AS ctvFullName, o.amount
     FROM orders o
     JOIN ctv_users c ON c.id = o.ctv_id
     WHERE o.payment_status = 'collected_by_ctv'
       AND NOT EXISTS (SELECT 1 FROM ctv_remittances r WHERE r.order_id = o.id)
     ORDER BY o.id DESC`
  );
  return rows as OutstandingCollection[];
}

export async function insertCtvRemittance(data: {
  orderId: number;
  ctvId: number;
  amount: number;
  note: string | null;
  remittedTo: string;
}): Promise<number> {
  const [result] = await getPool().query(
    "INSERT INTO ctv_remittances (order_id, ctv_id, amount, note, remitted_to) VALUES (?, ?, ?, ?, ?)",
    [data.orderId, data.ctvId, data.amount, data.note, data.remittedTo]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

// ---------- FWD: dashboard hiệu quả ----------

export type CtvDashboardStats = {
  totalCtvs: number;
  activeCtvs: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  pendingReviewCount: number;
  topCtvs: { ctvId: number; ctvCode: string; fullName: string; revenue: number }[];
};

export async function getCtvDashboardStats(): Promise<CtvDashboardStats> {
  const [countRows] = await getPool().query(
    `SELECT COUNT(*) AS total, SUM(status = 'active') AS active FROM ctv_users`
  );
  const countRow = (countRows as { total: number; active: string | null }[])[0];

  const [revenueRows] = await getPool().query(
    `SELECT
       COALESCE(SUM(CASE WHEN DATE_FORMAT(received_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN amount ELSE 0 END), 0) AS thisMonth,
       COALESCE(SUM(CASE WHEN DATE_FORMAT(received_date, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m') THEN amount ELSE 0 END), 0) AS lastMonth
     FROM orders
     WHERE source = 'ctv' AND review_status = 'approved'`
  );
  const revenueRow = (revenueRows as { thisMonth: string; lastMonth: string }[])[0];

  const [pendingRows] = await getPool().query(
    `SELECT COUNT(*) AS c FROM orders WHERE source = 'ctv' AND review_status = 'pending'`
  );
  const pendingReviewCount = (pendingRows as { c: number }[])[0]?.c ?? 0;

  const [topRows] = await getPool().query(
    `SELECT o.ctv_id AS ctvId, c.ctv_code AS ctvCode, c.full_name AS fullName, COALESCE(SUM(o.amount), 0) AS revenue
     FROM orders o
     JOIN ctv_users c ON c.id = o.ctv_id
     WHERE o.source = 'ctv' AND o.review_status = 'approved'
     GROUP BY o.ctv_id
     ORDER BY revenue DESC
     LIMIT 5`
  );

  return {
    totalCtvs: countRow?.total ?? 0,
    activeCtvs: Number(countRow?.active ?? 0),
    thisMonthRevenue: Number(revenueRow?.thisMonth ?? 0),
    lastMonthRevenue: Number(revenueRow?.lastMonth ?? 0),
    pendingReviewCount,
    topCtvs: (topRows as { ctvId: number; ctvCode: string; fullName: string; revenue: string }[]).map((r) => ({
      ctvId: r.ctvId,
      ctvCode: r.ctvCode,
      fullName: r.fullName,
      revenue: Number(r.revenue),
    })),
  };
}

// ---------- Kango: tạo bill (khởi tạo shipment) ----------

export type KangoBillStatus = "draft" | "sent";

export type KangoPackage = {
  packageQuantity: number;
  packageType: number; // 0 Carton, 1 Pallet, 2 Túi(Phong bì)
  packageLength: number;
  packageWidth: number;
  packageHeight: number;
  packageWeight: number;
};

export type KangoInvoiceItem = {
  invoiceGoodsDetails: string;
  invoiceQuantity: number;
  invoiceUnit: number; // 0 Pcs, 1 Bag, 2 Box, 3 Jar
  invoicePrice: number;
  invoiceTotalPrice: number;
};

export type KangoBill = {
  id: number;
  receiver_company_name: string;
  receiver_contact_name: string;
  receiver_telephone: string;
  receiver_country: string;
  receiver_state_name: string;
  receiver_city: string;
  receiver_postal_code: string;
  receiver_address_1: string;
  receiver_address_2: string | null;
  receiver_address_3: string | null;
  shipment_service: string;
  shipment_signature_flg: number;
  shipment_branch: string;
  shipment_reference_code: string | null;
  shipment_goods_name: string;
  shipment_value: string;
  shipment_export_as: number;
  packages_json: string;
  invoices_json: string | null;
  customer_note: string | null;
  status: KangoBillStatus;
  kango_bill_id: string | null;
  kango_hawbs_json: string | null;
  kango_redirect_url: string | null;
  send_error: string | null;
  created_by: string;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewKangoBill = {
  receiverCompanyName: string;
  receiverContactName: string;
  receiverTelephone: string;
  receiverCountry: string;
  receiverStateName: string;
  receiverCity: string;
  receiverPostalCode: string;
  receiverAddress1: string;
  receiverAddress2: string | null;
  receiverAddress3: string | null;
  shipmentService: string;
  shipmentSignatureFlg: boolean;
  shipmentBranch: string;
  shipmentReferenceCode: string | null;
  shipmentGoodsName: string;
  shipmentValue: number;
  shipmentExportAs: number;
  packages: KangoPackage[];
  invoices: KangoInvoiceItem[];
  customerNote: string | null;
  createdBy: string;
};

export async function listKangoBills(): Promise<KangoBill[]> {
  await ensureKangoBillSchema();
  const [rows] = await getPool().query("SELECT * FROM kango_bills ORDER BY id DESC");
  return rows as KangoBill[];
}

export async function findKangoBillById(id: number): Promise<KangoBill | null> {
  await ensureKangoBillSchema();
  const [rows] = await getPool().query("SELECT * FROM kango_bills WHERE id = ? LIMIT 1", [id]);
  const list = rows as KangoBill[];
  return list[0] ?? null;
}

export async function insertKangoBill(data: NewKangoBill): Promise<number> {
  await ensureKangoBillSchema();
  const [result] = await getPool().query(
    `INSERT INTO kango_bills
      (receiver_company_name, receiver_contact_name, receiver_telephone, receiver_country,
       receiver_state_name, receiver_city, receiver_postal_code, receiver_address_1,
       receiver_address_2, receiver_address_3, shipment_service, shipment_signature_flg,
       shipment_branch, shipment_reference_code, shipment_goods_name, shipment_value,
       shipment_export_as, packages_json, invoices_json, customer_note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.receiverCompanyName,
      data.receiverContactName,
      data.receiverTelephone,
      data.receiverCountry,
      data.receiverStateName,
      data.receiverCity,
      data.receiverPostalCode,
      data.receiverAddress1,
      data.receiverAddress2,
      data.receiverAddress3,
      data.shipmentService,
      data.shipmentSignatureFlg ? 1 : 0,
      data.shipmentBranch,
      data.shipmentReferenceCode,
      data.shipmentGoodsName,
      data.shipmentValue,
      data.shipmentExportAs,
      JSON.stringify(data.packages),
      JSON.stringify(data.invoices),
      data.customerNote,
      data.createdBy,
    ]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

export type KangoBillEditableFields = Partial<{
  receiverCompanyName: string;
  receiverContactName: string;
  receiverTelephone: string;
  receiverCountry: string;
  receiverStateName: string;
  receiverCity: string;
  receiverPostalCode: string;
  receiverAddress1: string;
  receiverAddress2: string | null;
  receiverAddress3: string | null;
  shipmentService: string;
  shipmentSignatureFlg: boolean;
  shipmentBranch: string;
  shipmentReferenceCode: string | null;
  shipmentGoodsName: string;
  shipmentValue: number;
  shipmentExportAs: number;
  packages: KangoPackage[];
  invoices: KangoInvoiceItem[];
  customerNote: string | null;
}>;

const KANGO_BILL_FIELD_COLUMNS: Record<keyof KangoBillEditableFields, string> = {
  receiverCompanyName: "receiver_company_name",
  receiverContactName: "receiver_contact_name",
  receiverTelephone: "receiver_telephone",
  receiverCountry: "receiver_country",
  receiverStateName: "receiver_state_name",
  receiverCity: "receiver_city",
  receiverPostalCode: "receiver_postal_code",
  receiverAddress1: "receiver_address_1",
  receiverAddress2: "receiver_address_2",
  receiverAddress3: "receiver_address_3",
  shipmentService: "shipment_service",
  shipmentSignatureFlg: "shipment_signature_flg",
  shipmentBranch: "shipment_branch",
  shipmentReferenceCode: "shipment_reference_code",
  shipmentGoodsName: "shipment_goods_name",
  shipmentValue: "shipment_value",
  shipmentExportAs: "shipment_export_as",
  packages: "packages_json",
  invoices: "invoices_json",
  customerNote: "customer_note",
};

export async function updateKangoBill(id: number, fields: KangoBillEditableFields): Promise<boolean> {
  await ensureKangoBillSchema();
  const entries = Object.entries(fields) as [keyof KangoBillEditableFields, unknown][];
  if (entries.length === 0) return false;
  const setClause = entries.map(([key]) => `${KANGO_BILL_FIELD_COLUMNS[key]} = ?`).join(", ");
  const values = entries.map(([key, value]) => {
    if (key === "shipmentSignatureFlg") return value ? 1 : 0;
    if (key === "packages" || key === "invoices") return JSON.stringify(value);
    return value;
  });
  const [result] = await getPool().query(
    `UPDATE kango_bills SET ${setClause} WHERE id = ?`,
    [...values, id]
  );
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export async function deleteKangoBill(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM kango_bills WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export async function markKangoBillSent(
  id: number,
  data: { sentBy: string; kangoBillId: string; hawbs: string[]; redirectUrl: string }
): Promise<void> {
  await ensureKangoBillSchema();
  await getPool().query(
    `UPDATE kango_bills
     SET status = 'sent', sent_by = ?, sent_at = NOW(), kango_bill_id = ?, kango_hawbs_json = ?, kango_redirect_url = ?, send_error = NULL
     WHERE id = ?`,
    [data.sentBy, data.kangoBillId, JSON.stringify(data.hawbs), data.redirectUrl, id]
  );
}

export async function markKangoBillSendFailed(id: number, error: string): Promise<void> {
  await getPool().query("UPDATE kango_bills SET send_error = ? WHERE id = ?", [error, id]);
}

export type KangoRecentReceiver = {
  receiverCompanyName: string;
  receiverContactName: string;
  receiverTelephone: string;
  receiverCountry: string;
  receiverStateName: string;
  receiverCity: string;
  receiverPostalCode: string;
  receiverAddress1: string;
  receiverAddress2: string | null;
  receiverAddress3: string | null;
};

/** Danh sách người nhận gần đây (gộp theo SĐT) để chọn nhanh khi khách gửi lại. */
export async function listRecentKangoReceivers(): Promise<KangoRecentReceiver[]> {
  const [rows] = await getPool().query(
    `SELECT
       receiver_company_name AS receiverCompanyName,
       receiver_contact_name AS receiverContactName,
       receiver_telephone AS receiverTelephone,
       receiver_country AS receiverCountry,
       receiver_state_name AS receiverStateName,
       receiver_city AS receiverCity,
       receiver_postal_code AS receiverPostalCode,
       receiver_address_1 AS receiverAddress1,
       receiver_address_2 AS receiverAddress2,
       receiver_address_3 AS receiverAddress3,
       MAX(id) AS lastId
     FROM kango_bills
     GROUP BY receiver_telephone
     ORDER BY lastId DESC
     LIMIT 50`
  );
  return rows as KangoRecentReceiver[];
}

export type KangoBillImage = {
  id: number;
  bill_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  data: Buffer;
  created_at: string;
};

export type KangoBillImageMeta = Omit<KangoBillImage, "data">;

export type NewKangoBillImage = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export async function insertKangoBillImages(
  billId: number,
  files: NewKangoBillImage[]
): Promise<number[]> {
  await ensureKangoBillSchema();
  const pool = getPool();
  const ids: number[] = [];
  for (const file of files) {
    const [result] = await pool.query(
      `INSERT INTO kango_bill_images (bill_id, filename, mime_type, file_size, data)
       VALUES (?, ?, ?, ?, ?)`,
      [billId, file.filename, file.mimeType, file.buffer.length, file.buffer]
    );
    ids.push((result as mysql.ResultSetHeader).insertId);
  }
  return ids;
}

export async function listKangoBillImages(billId: number): Promise<KangoBillImageMeta[]> {
  await ensureKangoBillSchema();
  const [rows] = await getPool().query(
    `SELECT id, bill_id, filename, mime_type, file_size, created_at
     FROM kango_bill_images
     WHERE bill_id = ?
     ORDER BY id ASC`,
    [billId]
  );
  return rows as KangoBillImageMeta[];
}

export async function findKangoBillImageById(id: number): Promise<KangoBillImage | null> {
  await ensureKangoBillSchema();
  const [rows] = await getPool().query(
    `SELECT id, bill_id, filename, mime_type, file_size, data, created_at
     FROM kango_bill_images
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const list = rows as KangoBillImage[];
  return list[0] ?? null;
}

export async function deleteKangoBillImage(id: number): Promise<boolean> {
  await ensureKangoBillSchema();
  const [result] = await getPool().query("DELETE FROM kango_bill_images WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

// ---------- Admin: quản lý đơn hàng ----------

export type OrderListItem = OrderRecord & {
  parcel_count: number;
  tracking_codes: string | null; // các mã tracking nối bằng dấu "," — dùng cho nút copy gửi khách
  ctv_code: string | null;
  ctv_full_name: string | null;
  shipment_status: ShipmentStatus | null; // null = chưa có bản cache tracking
  shipment_current: string | null;
  shipment_fetched_at: number | null;
};

export async function listOrders(params: {
  search: string;
  limit: number;
  offset: number;
  status?: "all" | PaymentStatus;
  month?: string; // "YYYY-MM"
  source?: "all" | OrderSource;
  reviewStatus?: "all" | OrderReviewStatus;
  ctvId?: number;
  /** true: chỉ đơn đã gắn FWD (ctv_id không rỗng); false: chỉ đơn không gắn FWD. */
  hasCtv?: boolean;
  /** Lọc ngày nhận hàng (YYYY-MM-DD, gồm cả 2 đầu). */
  receivedFrom?: string;
  receivedTo?: string;
}): Promise<{
  orders: OrderListItem[];
  total: number;
  paidCount: number;
  collectedByStaffCount: number;
  collectedByCtvCount: number;
  unpaidCount: number;
  pendingReviewCount: number;
}> {
  await ensureOrdersSchema();
  const { search, limit, offset, status = "all", month, source = "all", reviewStatus = "all", ctvId, hasCtv, receivedFrom, receivedTo } = params;
  const like = `%${search.trim()}%`;

  const conditions: string[] = [];
  const whereArgs: unknown[] = [];
  if (search.trim()) {
    conditions.push(
      `(o.falco_code LIKE ? OR o.awb LIKE ? OR o.recipient_name LIKE ? OR o.recipient_phone LIKE ?
        OR EXISTS (SELECT 1 FROM order_parcels op WHERE op.order_id = o.id AND op.tracking_code LIKE ?))`
    );
    whereArgs.push(like, like, like, like, like);
  }
  if (month) {
    conditions.push("DATE_FORMAT(o.received_date, '%Y-%m') = ?");
    whereArgs.push(month);
  }
  if (status === "paid" || status === "unpaid" || status === "collected_by_staff" || status === "collected_by_ctv") {
    conditions.push("o.payment_status = ?");
    whereArgs.push(status);
  }
  if (source === "staff" || source === "ctv") {
    conditions.push("o.source = ?");
    whereArgs.push(source);
  }
  if (reviewStatus !== "all") {
    conditions.push("o.review_status = ?");
    whereArgs.push(reviewStatus);
  }
  if (ctvId !== undefined) {
    conditions.push("o.ctv_id = ?");
    whereArgs.push(ctvId);
  }
  if (hasCtv === true) conditions.push("o.ctv_id IS NOT NULL");
  if (hasCtv === false) conditions.push("o.ctv_id IS NULL");
  if (receivedFrom) {
    conditions.push("COALESCE(o.received_date, DATE(o.created_at)) >= ?");
    whereArgs.push(receivedFrom);
  }
  if (receivedTo) {
    conditions.push("COALESCE(o.received_date, DATE(o.created_at)) <= ?");
    whereArgs.push(receivedTo);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rowsP = getPool().query(
    `SELECT o.*, COUNT(p.id) AS parcel_count,
       GROUP_CONCAT(p.tracking_code ORDER BY p.id SEPARATOR ',') AS tracking_codes,
       c.ctv_code AS ctv_code, c.full_name AS ctv_full_name,
       tc.shipment_status AS shipment_status, tc.current_status AS shipment_current,
       tc.fetched_at AS shipment_fetched_at
     FROM orders o
     LEFT JOIN order_parcels p ON p.order_id = o.id
     LEFT JOIN ctv_users c ON c.id = o.ctv_id
     LEFT JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
     ${where}
     GROUP BY o.id
     ORDER BY o.received_date DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [...whereArgs, limit, offset]
  );

  const countP = getPool().query(
    `SELECT COUNT(*) AS total FROM orders o ${where}`,
    whereArgs
  );

  // Đếm riêng theo trạng thái thu tiền theo đúng bộ lọc hiện tại (search, tháng,
  // nguồn, FWD, trạng thái duyệt — chỉ bỏ qua bộ lọc payment_status) để 3 thẻ KPI
  // và 5 tab trạng thái thu khớp với tập đơn đang xem.
  const searchMonthConditions: string[] = [];
  const searchMonthArgs: unknown[] = [];
  if (search.trim()) {
    searchMonthConditions.push(
      `(o.falco_code LIKE ? OR o.awb LIKE ? OR o.recipient_name LIKE ? OR o.recipient_phone LIKE ?
        OR EXISTS (SELECT 1 FROM order_parcels op WHERE op.order_id = o.id AND op.tracking_code LIKE ?))`
    );
    searchMonthArgs.push(like, like, like, like, like);
  }
  if (month) {
    searchMonthConditions.push("DATE_FORMAT(o.received_date, '%Y-%m') = ?");
    searchMonthArgs.push(month);
  }

  const statusConditions = [...searchMonthConditions];
  const statusArgs = [...searchMonthArgs];
  if (source === "staff" || source === "ctv") {
    statusConditions.push("o.source = ?");
    statusArgs.push(source);
  }
  if (reviewStatus !== "all") {
    statusConditions.push("o.review_status = ?");
    statusArgs.push(reviewStatus);
  }
  if (ctvId !== undefined) {
    statusConditions.push("o.ctv_id = ?");
    statusArgs.push(ctvId);
  }
  if (hasCtv === true) statusConditions.push("o.ctv_id IS NOT NULL");
  if (hasCtv === false) statusConditions.push("o.ctv_id IS NULL");

  const statusWhere = statusConditions.length ? `WHERE ${statusConditions.join(" AND ")}` : "";
  const statusP = getPool().query(
    `SELECT payment_status, COUNT(*) AS c FROM orders o ${statusWhere} GROUP BY payment_status`,
    statusArgs
  );

  const pendingConditions = [...searchMonthConditions, "o.source = 'ctv'", "o.review_status = 'pending'"];
  const pendingP = getPool().query(
    `SELECT COUNT(*) AS c FROM orders o WHERE ${pendingConditions.join(" AND ")}`,
    searchMonthArgs
  );
  const [[rows], [countRows], [statusRows], [pendingRows]] = await Promise.all([rowsP, countP, statusP, pendingP]);
  const total = (countRows as { total: number }[])[0]?.total ?? 0;
  let paidCount = 0;
  let collectedByStaffCount = 0;
  let collectedByCtvCount = 0;
  let unpaidCount = 0;
  for (const r of statusRows as { payment_status: PaymentStatus; c: number }[]) {
    if (r.payment_status === "paid") paidCount = r.c;
    else if (r.payment_status === "collected_by_staff") collectedByStaffCount = r.c;
    else if (r.payment_status === "collected_by_ctv") collectedByCtvCount = r.c;
    else unpaidCount = r.c;
  }
  const pendingReviewCount = Number((pendingRows as { c: number }[])[0]?.c ?? 0);

  return {
    orders: rows as OrderListItem[],
    total,
    paidCount,
    collectedByStaffCount,
    collectedByCtvCount,
    unpaidCount,
    pendingReviewCount,
  };
}

// ---------- Cache trạng thái tracking (xem scripts/setup-tracking-cache-table.ts) ----------

export type TrackingCacheRow = {
  order_id: number;
  awb: string;
  shipment_status: ShipmentStatus;
  current_status: string | null;
  payload: string | null; // JSON gốc của Kango; null = Kango chưa có dữ liệu cho đơn này
  fetched_at: number; // epoch ms
  last_error: string | null;
};

export async function getTrackingCache(orderId: number, awb: string): Promise<TrackingCacheRow | null> {
  const [rows] = await getPool().query(
    "SELECT * FROM order_tracking_cache WHERE order_id = ? AND awb = ? LIMIT 1",
    [orderId, awb]
  );
  return (rows as TrackingCacheRow[])[0] ?? null;
}

export async function upsertTrackingCache(entry: {
  orderId: number;
  awb: string;
  status: ShipmentStatus;
  currentStatus: string | null;
  payload: string | null;
}): Promise<void> {
  // Lưu ý thứ tự gán trong ON DUPLICATE KEY UPDATE của MySQL (trái → phải):
  // phải so sánh `awb = VALUES(awb)` TRƯỚC khi cập nhật `awb = VALUES(awb)`,
  // để khi đơn đổi sang AWB mới chưa có dữ liệu thì reset sạch hành trình cũ
  // thay vì giữ nhầm hành trình của AWB cũ.
  await getPool().query(
    `INSERT INTO order_tracking_cache (order_id, awb, shipment_status, current_status, payload, fetched_at, last_error)
     VALUES (?, ?, ?, ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
       shipment_status = IF(awb = VALUES(awb) AND VALUES(payload) IS NULL AND payload IS NOT NULL, shipment_status, VALUES(shipment_status)),
       current_status = IF(awb = VALUES(awb) AND VALUES(payload) IS NULL AND payload IS NOT NULL, current_status, VALUES(current_status)),
       fetched_at = IF(awb = VALUES(awb) AND VALUES(payload) IS NULL AND payload IS NOT NULL, fetched_at, VALUES(fetched_at)),
       payload = IF(awb = VALUES(awb), COALESCE(VALUES(payload), payload), VALUES(payload)),
       awb = VALUES(awb),
       last_error = NULL`,
    [
      entry.orderId,
      entry.awb,
      entry.status,
      entry.currentStatus ? entry.currentStatus.slice(0, 255) : null,
      entry.payload,
      Date.now(),
    ]
  );
}

// Lỗi gọi Kango: giữ nguyên bản cache cũ (kể cả fetched_at, để biết nó cũ cỡ nào), chỉ ghi lý do.
export async function markTrackingCacheError(orderId: number, message: string): Promise<void> {
  await getPool().query("UPDATE order_tracking_cache SET last_error = ? WHERE order_id = ?", [
    message.slice(0, 255),
    orderId,
  ]);
}

/**
 * Đơn cần làm mới tracking: đã duyệt, đã có AWB thật (loại trừ đơn thủ công
 * dùng tạm falco_code làm AWB), nằm trong cửa sổ `sinceDate` ngày gần nhất,
 * và chưa có cache hoặc chưa ở trạng thái cuối (đã giao/hoàn). Đơn chưa
 * từng có cache đi trước, sau đó tới bản cache cũ nhất — để lần chạy sau tiếp
 * tục đúng chỗ nếu lần trước hết ngân sách thời gian.
 */
export async function listOrdersNeedingTrackingRefresh(
  sinceDate: string, // "YYYY-MM-DD"
  limit: number,
  staleBeforeMs: number // chỉ lấy bản cache cũ hơn mốc này (epoch ms); đơn chưa có cache luôn được lấy
): Promise<{ id: number; awb: string; falco_code: string }[]> {
  const [rows] = await getPool().query(
    `SELECT o.id, o.awb, o.falco_code
     FROM orders o
     LEFT JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
     WHERE o.review_status IN ('auto_approved', 'approved')
       AND o.awb <> ''
       AND o.awb <> o.falco_code
       AND COALESCE(o.received_date, DATE(o.created_at)) >= ?
       AND (tc.order_id IS NULL
            OR (tc.shipment_status NOT IN ('delivered', 'returned') AND tc.fetched_at < ?))
     ORDER BY (tc.order_id IS NULL) DESC, tc.fetched_at ASC
     LIMIT ?`,
    [sinceDate, staleBeforeMs, limit]
  );
  return rows as { id: number; awb: string; falco_code: string }[];
}

export async function updatePaymentStatus(
  id: number,
  status: PaymentStatus
): Promise<boolean> {
  const [result] = await getPool().query(
    "UPDATE orders SET payment_status = ? WHERE id = ?",
    [status, id]
  );
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

// ---------- Admin: kế toán (thu/chi/lãi lỗ) ----------

/**
 * Tổng thu/chi/lãi-lỗ của các đơn nhận trong khoảng ngày [start, end] (YYYY-MM-DD,
 * bao gồm cả 2 đầu) — truyền null cho cả 2 để tính trên toàn bộ đơn (không giới
 * hạn ngày). Thu = tổng cột "amount" đã nhập, Chi = tổng cột "cost" đã nhập —
 * KHÔNG lọc theo trạng thái thu tiền. Trạng thái (Chưa thu/Thu hộ/Đã thu) chỉ
 * là chỉ báo vận hành riêng; ban đầu Thu từng chỉ tính cho đơn Thu hộ/Đã thu,
 * nhưng gây hiểu lầm khó phát hiện: nhập số vào ô Thu cho 1 đơn còn "Chưa thu"
 * (trạng thái mặc định) không lên tổng, trông giống như chỉ Chi hoạt động.
 */
export async function getOrderFinanceTotals(
  start: string | null,
  end: string | null
): Promise<{ thu: number; chiDon: number }> {
  const where = start && end ? "WHERE received_date BETWEEN ? AND ?" : "";
  const args = start && end ? [start, end] : [];
  const [rows] = await getPool().query(
    `SELECT
       COALESCE(SUM(amount), 0) AS thu,
       COALESCE(SUM(cost), 0) AS chiDon
     FROM orders ${where}`,
    args
  );
  const row = (rows as { thu: string; chiDon: string }[])[0];
  return { thu: Number(row?.thu ?? 0), chiDon: Number(row?.chiDon ?? 0) };
}

export type Expense = {
  id: number;
  description: string;
  amount: string;
  expense_date: string;
  created_at: string;
  updated_at: string;
};

export async function listExpenses(params?: {
  start?: string;
  end?: string;
}): Promise<Expense[]> {
  const conditions: string[] = [];
  const args: unknown[] = [];
  if (params?.start) {
    conditions.push("expense_date >= ?");
    args.push(params.start);
  }
  if (params?.end) {
    conditions.push("expense_date < DATE_ADD(?, INTERVAL 1 DAY)");
    args.push(params.end);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await getPool().query(
    `SELECT * FROM expenses ${where} ORDER BY expense_date DESC, id DESC`,
    args
  );
  return rows as Expense[];
}

export async function sumExpenses(start: string | null, end: string | null): Promise<number> {
  // expense_date là DATETIME (có giờ) — so sánh "<= 'YYYY-MM-DD'" sẽ ép về
  // 00:00:00 và bỏ sót mọi chi phí ghi sau nửa đêm của ngày cuối cùng, nên
  // dùng "< ngày kế tiếp" để lấy trọn ngày cuối.
  const where = start && end ? "WHERE expense_date >= ? AND expense_date < DATE_ADD(?, INTERVAL 1 DAY)" : "";
  const args = start && end ? [start, end] : [];
  const [rows] = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses ${where}`,
    args
  );
  return Number((rows as { total: string }[])[0]?.total ?? 0);
}

export async function insertExpense(data: {
  description: string;
  amount: number;
  expenseDate: string; // "YYYY-MM-DD HH:mm:ss"
}): Promise<number> {
  const [result] = await getPool().query(
    "INSERT INTO expenses (description, amount, expense_date) VALUES (?, ?, ?)",
    [data.description, data.amount, data.expenseDate]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

export async function updateExpense(
  id: number,
  data: Partial<{ description: string; amount: number; expenseDate: string }>
): Promise<boolean> {
  const map: Record<string, string> = {
    description: "description",
    amount: "amount",
    expenseDate: "expense_date",
  };
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return false;
  const setClause = entries.map(([key]) => `${map[key]} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  const [result] = await getPool().query(
    `UPDATE expenses SET ${setClause} WHERE id = ?`,
    [...values, id]
  );
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export async function deleteExpense(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM expenses WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

// ---------- Admin: cài đặt SEO theo trang ----------

export type SeoSetting = {
  page_path: string;
  meta_title: string | null;
  meta_description: string | null;
  updated_at: string;
};

export async function listSeoSettings(): Promise<SeoSetting[]> {
  const [rows] = await getPool().query(
    "SELECT * FROM seo_settings ORDER BY page_path"
  );
  return rows as SeoSetting[];
}

export async function getSeoSetting(
  pagePath: string
): Promise<SeoSetting | null> {
  const [rows] = await getPool().query(
    "SELECT * FROM seo_settings WHERE page_path = ? LIMIT 1",
    [pagePath]
  );
  const list = rows as SeoSetting[];
  return list[0] ?? null;
}

export async function upsertSeoSetting(
  pagePath: string,
  metaTitle: string,
  metaDescription: string
): Promise<void> {
  await getPool().query(
    `INSERT INTO seo_settings (page_path, meta_title, meta_description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE meta_title = VALUES(meta_title), meta_description = VALUES(meta_description)`,
    [pagePath, metaTitle, metaDescription]
  );
}

// ---------- Admin: lịch sử upload tài liệu ----------

/**
 * Chỉ lưu LẠI KẾT QUẢ xử lý (tên file, ai upload, số bill mới/cập nhật/
 * không đổi, lỗi nếu có) — KHÔNG lưu nội dung file gốc, tránh phình dung
 * lượng DB vì file Kango upload đều đặn 2 ngày/lần.
 */
export type UploadHistoryEntry = {
  id: number;
  file_name: string;
  uploaded_by: string;
  total_bills: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string | null; // JSON.stringify(string[]) hoặc null nếu không có lỗi
  snapshot: string | null; // JSON.stringify(UploadSnapshot) — dữ liệu để hoàn tác
  undone_at: string | null;
  created_at: string;
};

export async function insertUploadHistory(entry: {
  fileName: string;
  uploadedBy: string;
  totalBills: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string[];
  snapshot: unknown;
}): Promise<number> {
  const [result] = await getPool().query(
    `INSERT INTO upload_history
       (file_name, uploaded_by, total_bills, inserted, updated, unchanged, errors, snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.fileName,
      entry.uploadedBy,
      entry.totalBills,
      entry.inserted,
      entry.updated,
      entry.unchanged,
      entry.errors.length > 0 ? JSON.stringify(entry.errors) : null,
      JSON.stringify(entry.snapshot),
    ]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

export async function listUploadHistory(limit = 20): Promise<UploadHistoryEntry[]> {
  const [rows] = await getPool().query(
    "SELECT * FROM upload_history ORDER BY id DESC LIMIT ?",
    [limit]
  );
  return rows as UploadHistoryEntry[];
}

export async function findUploadHistoryById(id: number): Promise<UploadHistoryEntry | null> {
  const [rows] = await getPool().query(
    "SELECT * FROM upload_history WHERE id = ? LIMIT 1",
    [id]
  );
  const list = rows as UploadHistoryEntry[];
  return list[0] ?? null;
}

export async function markUploadHistoryUndone(id: number): Promise<void> {
  await getPool().query("UPDATE upload_history SET undone_at = NOW() WHERE id = ? AND undone_at IS NULL", [id]);
}

type UndoUploadSnapshotData = {
  insertedOrders?: { orderId: number; falcoCode: string }[];
  updatedOrders?: {
    orderId: number;
    recipientName: string | null;
    recipientPhone: string | null;
    recipientPostcode?: string | null;
    service: string | null;
    destination: string | null;
    receivedDate: string | null;
    trackingCodes?: string[];
    parcels?: { hawb?: string; trackingCode: string }[];
  }[];
};

/**
 * Hoàn tác 1 lượt upload Excel trong 1 transaction có khoá dòng (FOR UPDATE):
 * - Chặn chạy trùng khi 2 người bấm hoàn tác đồng thời.
 * - Khôi phục đủ trường (gồm cả recipient_postcode và hawb kiện hàng).
 * - Nếu bất kỳ bước DB nào lỗi → rollback toàn bộ và KHÔNG đánh dấu undone_at.
 */
export async function undoUploadHistoryTx(
  historyId: number
): Promise<{ ok: true; insertedFalcoCodes: string[] } | { ok: false; status: number; error: string }> {
  await ensureOrdersSchema();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM upload_history WHERE id = ? LIMIT 1 FOR UPDATE", [historyId]);
    const entry = (rows as UploadHistoryEntry[])[0];
    if (!entry) {
      await conn.rollback();
      return { ok: false, status: 404, error: "Không tìm thấy lượt upload này" };
    }
    if (entry.undone_at) {
      await conn.rollback();
      return { ok: false, status: 400, error: "Lượt upload này đã được hoàn tác trước đó" };
    }
    if (!entry.snapshot) {
      await conn.rollback();
      return {
        ok: false,
        status: 400,
        error: "Lượt upload này không có dữ liệu để hoàn tác (upload trước khi tính năng này ra mắt)",
      };
    }

    let snapshot: UndoUploadSnapshotData;
    try {
      snapshot = JSON.parse(entry.snapshot) as UndoUploadSnapshotData;
    } catch {
      await conn.rollback();
      return { ok: false, status: 400, error: "Dữ liệu hoàn tác bị lỗi, không đọc được" };
    }

    const updatedOrders = Array.isArray(snapshot.updatedOrders) ? snapshot.updatedOrders : [];
    const insertedOrders = Array.isArray(snapshot.insertedOrders) ? snapshot.insertedOrders : [];

    for (const u of updatedOrders) {
      const [existsRows] = await conn.query("SELECT id FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [u.orderId]);
      if ((existsRows as unknown[]).length === 0) continue;

      const hasPostcode = "recipientPostcode" in u;
      if (hasPostcode) {
        await conn.query(
          `UPDATE orders
           SET recipient_name = ?, recipient_phone = ?, recipient_postcode = ?, service = ?, destination = ?, received_date = ?
           WHERE id = ?`,
          [
            u.recipientName ?? "",
            u.recipientPhone ?? "",
            u.recipientPostcode ?? null,
            u.service ?? "",
            u.destination ?? "",
            toIsoDateLocal(u.receivedDate ?? null),
            u.orderId,
          ]
        );
      } else {
        await conn.query(
          `UPDATE orders
           SET recipient_name = ?, recipient_phone = ?, service = ?, destination = ?, received_date = ?
           WHERE id = ?`,
          [
            u.recipientName ?? "",
            u.recipientPhone ?? "",
            u.service ?? "",
            u.destination ?? "",
            toIsoDateLocal(u.receivedDate ?? null),
            u.orderId,
          ]
        );
      }

      const parcelsToRestore: ParcelInput[] = Array.isArray(u.parcels)
        ? u.parcels.map((p) => ({ hawb: p.hawb ?? "", trackingCode: String(p.trackingCode ?? "") }))
        : Array.isArray(u.trackingCodes)
          ? u.trackingCodes.map((c) => ({ hawb: "", trackingCode: String(c) }))
          : [];
      await replaceOrderParcelsOnConn(conn, u.orderId, parcelsToRestore);
    }

    for (const ins of insertedOrders) {
      await conn.query("DELETE FROM orders WHERE id = ?", [ins.orderId]);
    }

    const [markRes] = await conn.query(
      "UPDATE upload_history SET undone_at = NOW() WHERE id = ? AND undone_at IS NULL",
      [historyId]
    );
    if ((markRes as mysql.ResultSetHeader).affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, status: 400, error: "Lượt upload này đã được hoàn tác trước đó" };
    }

    await conn.commit();
    monthsCache = null;
    return { ok: true, insertedFalcoCodes: insertedOrders.map((o) => o.falcoCode) };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

// ---------- Admin: lịch sử chỉnh sửa đơn (để hoàn tác) ----------

/**
 * Mỗi lần 1 đơn bị SỬA hoặc XOÁ qua admin (Đơn hàng, Kế toán), lưu lại
 * NGUYÊN TRẠNG trước đó vào đây trước khi áp thay đổi — cho phép hoàn tác
 * nếu sửa/xoá nhầm.
 */
export type OrderEditHistoryEntry = {
  id: number;
  order_id: number;
  action: "update" | "delete";
  before_data: string; // JSON: { order: OrderRecord, trackingCodes: string[], parcels?: { hawb: string; trackingCode: string }[] }
  changed_by: string;
  undone_at: string | null;
  created_at: string;
};

export async function insertOrderEditHistory(entry: {
  orderId: number;
  action: "update" | "delete";
  beforeData: unknown;
  changedBy: string;
}): Promise<number> {
  const [result] = await getPool().query(
    `INSERT INTO order_edit_history (order_id, action, before_data, changed_by)
     VALUES (?, ?, ?, ?)`,
    [entry.orderId, entry.action, JSON.stringify(entry.beforeData), entry.changedBy]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

export async function listOrderEditHistory(limit = 30): Promise<OrderEditHistoryEntry[]> {
  const [rows] = await getPool().query(
    "SELECT * FROM order_edit_history ORDER BY id DESC LIMIT ?",
    [limit]
  );
  return rows as OrderEditHistoryEntry[];
}

export async function findOrderEditHistoryById(
  id: number
): Promise<OrderEditHistoryEntry | null> {
  const [rows] = await getPool().query(
    "SELECT * FROM order_edit_history WHERE id = ? LIMIT 1",
    [id]
  );
  const list = rows as OrderEditHistoryEntry[];
  return list[0] ?? null;
}

export async function markOrderEditHistoryUndone(id: number): Promise<void> {
  await getPool().query("UPDATE order_edit_history SET undone_at = NOW() WHERE id = ? AND undone_at IS NULL", [id]);
}

type OrderEditBeforeData = {
  order?: OrderRecord;
  trackingCodes?: string[];
  parcels?: { hawb?: string; trackingCode: string }[];
};

function parseNullableNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function parseNullableTimestamp(val: string | Date | null | undefined): Date | null {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Hoàn tác 1 lượt sửa/xoá đơn trong 1 transaction có khoá dòng (FOR UPDATE):
 * - Chống hoàn tác 2 lần đồng thời.
 * - Khôi phục đầy đủ các cột: weight_kg, source, ctv_id, review_status,
 *   reviewed_by, reviewed_at, recipient_postcode, payment_status, collected_date,
 *   amount, cost, chi_source_invoice và hawb của từng kiện hàng.
 */
export async function undoOrderEditHistoryTx(
  historyId: number
): Promise<{ ok: true; restoredOrderId: number } | { ok: false; status: number; error: string }> {
  await ensureOrdersSchema();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT * FROM order_edit_history WHERE id = ? LIMIT 1 FOR UPDATE", [historyId]);
    const entry = (rows as OrderEditHistoryEntry[])[0];
    if (!entry) {
      await conn.rollback();
      return { ok: false, status: 404, error: "Không tìm thấy lịch sử chỉnh sửa" };
    }
    if (entry.undone_at) {
      await conn.rollback();
      return { ok: false, status: 400, error: "Lượt sửa này đã được hoàn tác trước đó" };
    }

    let before: OrderEditBeforeData;
    try {
      before = JSON.parse(entry.before_data) as OrderEditBeforeData;
    } catch {
      await conn.rollback();
      return { ok: false, status: 400, error: "Dữ liệu hoàn tác bị lỗi, không đọc được" };
    }

    const o = before.order;
    if (!o) {
      await conn.rollback();
      return { ok: false, status: 400, error: "Thiếu dữ liệu đơn hàng trong bản lưu hoàn tác" };
    }

    const parcelsToRestore: ParcelInput[] = Array.isArray(before.parcels)
      ? before.parcels.map((p) => ({ hawb: p.hawb ?? "", trackingCode: String(p.trackingCode ?? "") }))
      : Array.isArray(before.trackingCodes)
        ? before.trackingCodes.map((c) => ({ hawb: "", trackingCode: String(c) }))
        : [];

    // Nếu FWD gắn trước đó đã bị xoá khỏi ctv_users, gán null để tránh lỗi khoá ngoại fk_orders_ctv.
    let restoredCtvId: number | null = o.ctv_id ?? null;
    if (restoredCtvId !== null) {
      const [ctvRows] = await conn.query("SELECT id FROM ctv_users WHERE id = ? LIMIT 1", [restoredCtvId]);
      if ((ctvRows as unknown[]).length === 0) {
        restoredCtvId = null;
      }
    }

    const receivedDate = toIsoDateLocal(o.received_date);
    const collectedDate = toIsoDateLocal(o.collected_date ?? null);
    const amount = parseNullableNumber(o.amount);
    const cost = parseNullableNumber(o.cost);
    const weightKg = parseNullableNumber(o.weight_kg);
    const source: OrderSource = o.source === "ctv" ? "ctv" : "staff";
    const reviewStatus: OrderReviewStatus =
      o.review_status === "pending" ||
      o.review_status === "approved" ||
      o.review_status === "rejected" ||
      o.review_status === "auto_approved"
        ? o.review_status
        : "auto_approved";
    const reviewedBy = o.reviewed_by ?? null;
    const reviewedAt = parseNullableTimestamp(o.reviewed_at);

    let restoredOrderId: number;

    if (entry.action === "update") {
      const [existsRows] = await conn.query("SELECT id FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [entry.order_id]);
      if ((existsRows as unknown[]).length === 0) {
        await conn.rollback();
        return {
          ok: false,
          status: 409,
          error: "Đơn này đã bị xoá sau lần sửa — không thể hoàn tác qua đây, hãy hoàn tác lượt xoá thay vào đó",
        };
      }
      await conn.query(
        `UPDATE orders
         SET awb = ?, recipient_name = ?, recipient_phone = ?, recipient_postcode = ?,
             service = ?, destination = ?, received_date = ?, payment_status = ?,
             collected_date = ?, amount = ?, cost = ?, chi_source_invoice = ?,
             weight_kg = ?, source = ?, ctv_id = ?, review_status = ?,
             reviewed_by = ?, reviewed_at = ?
         WHERE id = ?`,
        [
          o.awb,
          o.recipient_name ?? "",
          o.recipient_phone ?? "",
          o.recipient_postcode ?? null,
          o.service ?? "",
          o.destination ?? "",
          receivedDate,
          o.payment_status ?? "unpaid",
          collectedDate,
          amount,
          cost,
          o.chi_source_invoice ?? null,
          weightKg,
          source,
          restoredCtvId,
          reviewStatus,
          reviewedBy,
          reviewedAt,
          entry.order_id,
        ]
      );
      await replaceOrderParcelsOnConn(conn, entry.order_id, parcelsToRestore);
      restoredOrderId = entry.order_id;
    } else {
      const [insertRes] = await conn.query(
        `INSERT INTO orders
          (falco_code, awb, recipient_name, recipient_phone, recipient_postcode,
           service, destination, received_date, payment_status, collected_date,
           amount, cost, chi_source_invoice, weight_kg, source, ctv_id,
           review_status, reviewed_by, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          o.falco_code,
          o.awb,
          o.recipient_name ?? "",
          o.recipient_phone ?? "",
          o.recipient_postcode ?? null,
          o.service ?? "",
          o.destination ?? "",
          receivedDate,
          o.payment_status ?? "unpaid",
          collectedDate,
          amount,
          cost,
          o.chi_source_invoice ?? null,
          weightKg,
          source,
          restoredCtvId,
          reviewStatus,
          reviewedBy,
          reviewedAt,
        ]
      );
      restoredOrderId = (insertRes as mysql.ResultSetHeader).insertId;
      await replaceOrderParcelsOnConn(conn, restoredOrderId, parcelsToRestore);
    }

    const [markRes] = await conn.query(
      "UPDATE order_edit_history SET undone_at = NOW() WHERE id = ? AND undone_at IS NULL",
      [historyId]
    );
    if ((markRes as mysql.ResultSetHeader).affectedRows !== 1) {
      await conn.rollback();
      return { ok: false, status: 400, error: "Lượt sửa này đã được hoàn tác trước đó" };
    }

    await conn.commit();
    monthsCache = null;
    return { ok: true, restoredOrderId };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

// ---------- Admin: Báo giá (bảng giá + chính sách gửi khách) ----------

export type PriceQuoteLineRow = {
  id: number;
  category_id: number;
  position: number;
  title: string;
  countries: string | null;
  min_weight_kg: string | null;
  markup_flat_vnd: number;
  markup_per_kg_vnd: number;
  rows_json: string; // JSON.stringify(ParsedPriceRow[]) — giá GỐC Kango, chưa cộng markup
  created_at: string;
  updated_at: string;
};

export type PriceQuoteCategoryRow = {
  id: number;
  slug: string;
  title: string;
  position: number;
  note: string | null;
  source_file_name: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PriceQuoteCategoryWithLines = PriceQuoteCategoryRow & { lines: PriceQuoteLineRow[] };

export async function listPriceQuoteCategories(): Promise<PriceQuoteCategoryWithLines[]> {
  const [categoryRows] = await getPool().query(
    "SELECT * FROM price_quote_categories ORDER BY position, id"
  );
  const categories = categoryRows as PriceQuoteCategoryRow[];
  if (categories.length === 0) return [];

  const [lineRows] = await getPool().query(
    "SELECT * FROM price_quote_lines WHERE category_id IN (?) ORDER BY position, id",
    [categories.map((c) => c.id)]
  );
  const lines = lineRows as PriceQuoteLineRow[];

  return categories.map((category) => ({
    ...category,
    lines: lines.filter((l) => l.category_id === category.id),
  }));
}

/**
 * Thay TOÀN BỘ bảng giá bằng kết quả parse mới nhất từ file Kango vừa
 * upload — xoá sạch categories+lines cũ, insert lại từ đầu trong 1
 * transaction (tất-cả-hoặc-không-gì). Đây là cách DUY NHẤT để cập nhật GIÁ
 * GỐC sau khi đã upload lần đầu (đã chốt với người dùng — sửa tay từng ô
 * dễ lệch dữ liệu với ~40 dòng/bảng).
 */
export async function replaceAllPriceQuoteCategories(
  categories: ParsedCategory[],
  meta: { sourceFileName: string; uploadedBy: string }
): Promise<void> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM price_quote_categories"); // cascade xoá lines
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      const [result] = await conn.query(
        `INSERT INTO price_quote_categories (slug, title, position, note, source_file_name, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [c.slug, c.title, i, c.note, meta.sourceFileName, meta.uploadedBy]
      );
      const categoryId = (result as mysql.ResultSetHeader).insertId;
      for (let j = 0; j < c.lines.length; j++) {
        const l = c.lines[j];
        await conn.query(
          `INSERT INTO price_quote_lines
             (category_id, position, title, countries, min_weight_kg, markup_flat_vnd, markup_per_kg_vnd, rows_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [categoryId, j, l.title, l.countries, l.minWeightKg, l.markupFlatVnd, l.markupPerKgVnd, JSON.stringify(l.rows)]
        );
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updatePriceQuoteCategoryMeta(
  id: number,
  fields: { title?: string; note?: string | null }
): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (fields.title !== undefined) {
    sets.push("title = ?");
    args.push(fields.title);
  }
  if (fields.note !== undefined) {
    sets.push("note = ?");
    args.push(fields.note);
  }
  if (sets.length === 0) return;
  args.push(id);
  await getPool().query(`UPDATE price_quote_categories SET ${sets.join(", ")} WHERE id = ?`, args);
}

export async function deletePriceQuoteCategory(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM price_quote_categories WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export async function updatePriceQuoteLineMeta(
  id: number,
  fields: {
    title?: string;
    countries?: string | null;
    minWeightKg?: number | null;
    markupFlatVnd?: number;
    markupPerKgVnd?: number;
  }
): Promise<void> {
  const map: Record<string, unknown> = {
    title: fields.title,
    countries: fields.countries,
    min_weight_kg: fields.minWeightKg,
    markup_flat_vnd: fields.markupFlatVnd,
    markup_per_kg_vnd: fields.markupPerKgVnd,
  };
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const [col, value] of Object.entries(map)) {
    if (value === undefined) continue;
    sets.push(`${col} = ?`);
    args.push(value);
  }
  if (sets.length === 0) return;
  args.push(id);
  await getPool().query(`UPDATE price_quote_lines SET ${sets.join(", ")} WHERE id = ?`, args);
}

export async function deletePriceQuoteLine(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM price_quote_lines WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export type PriceQuotePolicyItem = {
  id: number;
  position: number;
  content: string;
  created_at: string;
  updated_at: string;
};

export async function listPolicyItems(): Promise<PriceQuotePolicyItem[]> {
  const [rows] = await getPool().query(
    "SELECT * FROM price_quote_policy_items ORDER BY position, id"
  );
  return rows as PriceQuotePolicyItem[];
}

export async function insertPolicyItem(content: string, position = 0): Promise<number> {
  const [result] = await getPool().query(
    "INSERT INTO price_quote_policy_items (content, position) VALUES (?, ?)",
    [content, position]
  );
  return (result as mysql.ResultSetHeader).insertId;
}

export async function updatePolicyItem(id: number, content: string): Promise<void> {
  await getPool().query("UPDATE price_quote_policy_items SET content = ? WHERE id = ?", [content, id]);
}

export async function deletePolicyItem(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM price_quote_policy_items WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

// ---------- Nhập đơn cho AI tạo bill (ghi chú + ảnh, lưu trong MySQL) ----------
//
// Ban đầu định lưu ảnh trên Google Drive qua service account có sẵn, nhưng
// service account KHÔNG có storage quota trên Drive cá nhân (chỉ hoạt động
// với Shared Drive — cần Google Workspace trả phí, hoặc OAuth uỷ quyền —
// không khả thi với Gmail cá nhân). Chuyển sang lưu thẳng trong MySQL
// (LONGBLOB) như mọi dữ liệu khác của dự án — đơn giản hơn, không cần thêm
// bước Google Cloud nào, và đọc lại được trực tiếp khi xử lý.

export type AiIntakeOrderStatus = "pending" | "processed";

export type AiIntakeOrder = {
  id: number;
  note: string;
  status: AiIntakeOrderStatus;
  created_by: string;
  created_at: string;
  processed_at: string | null;
};

export type AiIntakeOrderWithImageCount = AiIntakeOrder & { imageCount: number };

export type NewAiIntakeImage = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export async function insertAiIntakeOrder(
  note: string,
  images: NewAiIntakeImage[],
  createdBy: string
): Promise<number> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query("INSERT INTO ai_intake_orders (note, created_by) VALUES (?, ?)", [
      note,
      createdBy,
    ]);
    const orderId = (result as mysql.ResultSetHeader).insertId;

    for (const image of images) {
      await conn.query(
        "INSERT INTO ai_intake_images (order_id, filename, mime_type, file_size, data) VALUES (?, ?, ?, ?, ?)",
        [orderId, image.filename, image.mimeType, image.buffer.length, image.buffer]
      );
    }

    await conn.commit();
    return orderId;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

export async function listPendingAiIntakeOrders(): Promise<AiIntakeOrderWithImageCount[]> {
  const [rows] = await getPool().query(
    `SELECT o.id, o.note, o.status, o.created_by, o.created_at, o.processed_at,
            COUNT(i.id) AS imageCount
     FROM ai_intake_orders o
     LEFT JOIN ai_intake_images i ON i.order_id = o.id
     WHERE o.status = 'pending'
     GROUP BY o.id
     ORDER BY o.created_at DESC`
  );
  return rows as AiIntakeOrderWithImageCount[];
}

export async function deleteAiIntakeOrder(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM ai_intake_orders WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export async function markAiIntakeOrderProcessed(id: number): Promise<boolean> {
  const [result] = await getPool().query(
    "UPDATE ai_intake_orders SET status = 'processed', processed_at = NOW() WHERE id = ?",
    [id]
  );
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export type AiIntakeImage = {
  id: number;
  order_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  data: Buffer;
};

export async function findAiIntakeImageById(id: number): Promise<AiIntakeImage | null> {
  const [rows] = await getPool().query("SELECT * FROM ai_intake_images WHERE id = ? LIMIT 1", [id]);
  const list = rows as AiIntakeImage[];
  return list[0] ?? null;
}

export async function listAiIntakeImagesByOrder(
  orderId: number
): Promise<Pick<AiIntakeImage, "id" | "filename" | "mime_type">[]> {
  const [rows] = await getPool().query(
    "SELECT id, filename, mime_type FROM ai_intake_images WHERE order_id = ? ORDER BY id",
    [orderId]
  );
  return rows as Pick<AiIntakeImage, "id" | "filename" | "mime_type">[];
}

// ---------- DBN: báo giá cước gửi khách (nhập tay theo mẫu Excel) ----------
//
// Chỉ giữ lại 10 bản DBN gần nhất kèm ảnh trong MySQL — cũ hơn tự xoá hẳn
// (không phải chỗ lưu trữ lâu dài, chỉ để "lỡ cần tải lại" ngay sau khi tạo).

const DBN_KEEP_COUNT = 10;

export type DbnRow = {
  orderId: number | null; // gắn với 1 đơn có thật trong hệ thống, nếu chọn từ danh sách
  label: string; // MÃ ĐƠN HÀNG / tên khách trên dòng này
  ngay?: string; // ngày của đơn (dd/mm/yyyy) — báo giá cũ chưa có
  diaChi: string;
  kichThuoc: string; // "dài x rộng x cao", không bắt buộc
  dimKg: number | null;
  canThucKg: number | null;
  donGiaPerKg: number | null; // null với đơn <21kg (giá cố định, nhập thẳng thanhTien)
  phuPhi: number;
  thanhTien: number;
  ghiChu: string;
};

export type DbnQuote = {
  id: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  quote_date: string;
  rows_json: string;
  total_amount: string;
  created_by: string;
  created_at: string;
};

export type NewDbnQuote = {
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  quoteDate: string; // "YYYY-MM-DD"
  rows: DbnRow[];
  totalAmount: number;
  createdBy: string;
};

export async function insertDbnQuote(data: NewDbnQuote): Promise<number> {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO dbn_quotes (customer_name, customer_phone, customer_email, quote_date, rows_json, total_amount, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.customerName,
      data.customerPhone,
      data.customerEmail,
      data.quoteDate,
      JSON.stringify(data.rows),
      data.totalAmount,
      data.createdBy,
    ]
  );
  const id = (result as mysql.ResultSetHeader).insertId;

  await pool.query(
    `DELETE FROM dbn_quotes WHERE id NOT IN (
       SELECT id FROM (SELECT id FROM dbn_quotes ORDER BY created_at DESC LIMIT ?) t
     )`,
    [DBN_KEEP_COUNT]
  );

  return id;
}

export async function updateDbnQuoteImage(id: number, image: Buffer): Promise<void> {
  await getPool().query("UPDATE dbn_quotes SET image = ? WHERE id = ?", [image, id]);
}

export async function listDbnQuotes(): Promise<DbnQuote[]> {
  const [rows] = await getPool().query(
    `SELECT id, customer_name, customer_phone, customer_email, quote_date, rows_json,
            total_amount, created_by, created_at
     FROM dbn_quotes ORDER BY created_at DESC LIMIT ?`,
    [DBN_KEEP_COUNT]
  );
  return rows as DbnQuote[];
}

export async function findDbnQuoteImageById(id: number): Promise<Buffer | null> {
  const [rows] = await getPool().query("SELECT image FROM dbn_quotes WHERE id = ? LIMIT 1", [id]);
  const list = rows as { image: Buffer | null }[];
  return list[0]?.image ?? null;
}

export async function deleteDbnQuote(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM dbn_quotes WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}
