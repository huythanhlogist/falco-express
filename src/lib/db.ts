import mysql from "mysql2/promise";
import type { ParsedCategory } from "./price-quote-import";

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
      connectionLimit: 5,
      queueLimit: 0,
      // Giữ kết nối sống qua TCP keepalive — tránh lỗi "write EPIPE" khi kết
      // nối bị firewall/NAT âm thầm đóng sau một thời gian không hoạt động
      // (hay gặp khi app kết nối MySQL qua WAN, vd chạy dev từ máy cá nhân).
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
    });
  }
  return pool;
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
  service: string | null;
  destination: string | null;
  received_date: string | null;
  payment_status: PaymentStatus;
  amount: string | null;
  cost: string | null;
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

export async function insertOrder(order: NewOrder): Promise<number> {
  const [result] = await getPool().query(
    `INSERT INTO orders
      (falco_code, awb, recipient_name, recipient_phone, service, destination, received_date,
       weight_kg, amount, cost, source, ctv_id, review_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.falcoCode,
      order.awb,
      order.recipientName,
      order.recipientPhone,
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
  return (result as mysql.ResultSetHeader).insertId;
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

/** Thay toàn bộ danh sách kiện của 1 đơn — dùng cho form sửa đơn trong admin. */
export async function replaceOrderParcels(
  orderId: number,
  trackingCodes: string[]
): Promise<void> {
  await getPool().query("DELETE FROM order_parcels WHERE order_id = ?", [orderId]);
  const codes = trackingCodes.map((c) => c.trim()).filter(Boolean);
  if (codes.length === 0) return;
  const values = codes.map((code) => [orderId, "", code]);
  await getPool().query(
    "INSERT INTO order_parcels (order_id, hawb, tracking_code) VALUES ?",
    [values]
  );
}

export type OrderEditableFields = Partial<{
  awb: string;
  recipientName: string;
  recipientPhone: string;
  service: string;
  destination: string;
  receivedDate: string | null;
  paymentStatus: PaymentStatus;
  amount: number | null;
  cost: number | null;
  weightKg: number | null;
}>;

const ORDER_FIELD_COLUMNS: Record<keyof OrderEditableFields, string> = {
  awb: "awb",
  recipientName: "recipient_name",
  recipientPhone: "recipient_phone",
  service: "service",
  destination: "destination",
  receivedDate: "received_date",
  paymentStatus: "payment_status",
  amount: "amount",
  cost: "cost",
  weightKg: "weight_kg",
};

export async function updateOrder(
  id: number,
  fields: OrderEditableFields
): Promise<boolean> {
  const entries = Object.entries(fields) as [keyof OrderEditableFields, unknown][];
  if (entries.length === 0) return false;
  const setClause = entries.map(([key]) => `${ORDER_FIELD_COLUMNS[key]} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  const [result] = await getPool().query(
    `UPDATE orders SET ${setClause} WHERE id = ?`,
    [...values, id]
  );
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

export async function deleteOrder(id: number): Promise<boolean> {
  const [result] = await getPool().query("DELETE FROM orders WHERE id = ?", [id]);
  return (result as mysql.ResultSetHeader).affectedRows > 0;
}

/** Duyệt 1 đơn do CTV tạo — chỉ tác dụng khi đơn đang "chờ duyệt". */
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
export async function listOrderMonths(): Promise<string[]> {
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

export async function listFalcoCodeSet(): Promise<Set<string>> {
  const [rows] = await getPool().query("SELECT falco_code FROM orders");
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

// ---------- CTV: tài khoản cộng tác viên ----------

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

/** Danh sách CTV cho tab "Quản lý CTV" — kèm tên người giới thiệu (nếu có). */
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
 * ctv_code ("mã riêng") được sinh từ chính id sau khi insert (CTV-0001,
 * CTV-0002, ...) — luôn duy nhất vì id là AUTO_INCREMENT, không cần khoá
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
  const ctvCode = `CTV-${String(id).padStart(4, "0")}`;
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
 * Dùng chung cho cả admin sửa hồ sơ CTV (mọi field) lẫn CTV tự sửa liên hệ
 * hiển thị trên bảng giá (chỉ contact*) — giới hạn field nào được sửa nằm ở
 * route handler gọi hàm này, không phải ở đây.
 */
export async function updateCtvUser(id: number, fields: CtvEditableFields): Promise<boolean> {
  const entries = Object.entries(fields) as [keyof CtvEditableFields, unknown][];
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

// ---------- CTV: nội dung hướng dẫn + nhóm/kênh (admin quản lý, CTV chỉ xem) ----------

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
  const entries = Object.entries(fields) as [keyof typeof fields, unknown][];
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

// ---------- CTV: hoa hồng + công nợ ----------

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

/** "Thống kê doanh thu + sản lượng (kg)" của 1 CTV, chia theo destination — chỉ tính đơn đã duyệt. */
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

/** Sổ công nợ (chiều Falco nợ CTV) cho tab "Công nợ" ở admin — 1 dòng / CTV. */
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

/** Đơn CTV thu hộ khách nhưng CHƯA xác nhận nộp lại cho Falco (chiều CTV nợ Falco). */
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

// ---------- CTV: dashboard hiệu quả ----------

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

// ---------- Admin: quản lý đơn hàng ----------

export type OrderListItem = OrderRecord & {
  parcel_count: number;
  tracking_codes: string | null; // các mã tracking nối bằng dấu "," — dùng cho nút copy gửi khách
  ctv_code: string | null;
  ctv_full_name: string | null;
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
}): Promise<{
  orders: OrderListItem[];
  total: number;
  paidCount: number;
  collectedByStaffCount: number;
  collectedByCtvCount: number;
  unpaidCount: number;
  pendingReviewCount: number;
}> {
  const { search, limit, offset, status = "all", month, source = "all", reviewStatus = "all", ctvId } = params;
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
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await getPool().query(
    `SELECT o.*, COUNT(p.id) AS parcel_count,
       GROUP_CONCAT(p.tracking_code ORDER BY p.id SEPARATOR ',') AS tracking_codes,
       c.ctv_code AS ctv_code, c.full_name AS ctv_full_name
     FROM orders o
     LEFT JOIN order_parcels p ON p.order_id = o.id
     LEFT JOIN ctv_users c ON c.id = o.ctv_id
     ${where}
     GROUP BY o.id
     ORDER BY o.received_date DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [...whereArgs, limit, offset]
  );

  const [countRows] = await getPool().query(
    `SELECT COUNT(*) AS total FROM orders o ${where}`,
    whereArgs
  );
  const total = (countRows as { total: number }[])[0]?.total ?? 0;

  // Đếm riêng theo trạng thái thu tiền + số đơn CTV đang chờ duyệt (không áp
  // bộ lọc status/source/reviewStatus, chỉ áp tìm kiếm + tháng) để hiển thị
  // số lượng trên các tab lọc kể cả khi đang xem tab khác.
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
  const searchOnlyWhere = searchMonthConditions.length
    ? `WHERE ${searchMonthConditions.join(" AND ")}`
    : "";
  const [statusRows] = await getPool().query(
    `SELECT payment_status, COUNT(*) AS c FROM orders o ${searchOnlyWhere} GROUP BY payment_status`,
    searchMonthArgs
  );
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

  const pendingConditions = [...searchMonthConditions, "o.source = 'ctv'", "o.review_status = 'pending'"];
  const [pendingRows] = await getPool().query(
    `SELECT COUNT(*) AS c FROM orders o WHERE ${pendingConditions.join(" AND ")}`,
    searchMonthArgs
  );
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
  await getPool().query("UPDATE upload_history SET undone_at = NOW() WHERE id = ?", [id]);
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
  before_data: string; // JSON: { order: OrderRecord, parcels: string[] }
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
  await getPool().query("UPDATE order_edit_history SET undone_at = NOW() WHERE id = ?", [id]);
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
