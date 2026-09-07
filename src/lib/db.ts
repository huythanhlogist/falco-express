import mysql from "mysql2/promise";

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

export type PaymentStatus = "unpaid" | "collected_by_staff" | "paid";

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
};

export async function insertOrder(order: NewOrder): Promise<number> {
  const [result] = await getPool().query(
    `INSERT INTO orders (falco_code, awb, recipient_name, recipient_phone, service, destination, received_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      order.falcoCode,
      order.awb,
      order.recipientName,
      order.recipientPhone,
      order.service,
      order.destination,
      order.receivedDate,
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

// ---------- Admin: quản lý đơn hàng ----------

export type OrderListItem = OrderRecord & { parcel_count: number };

export async function listOrders(params: {
  search: string;
  limit: number;
  offset: number;
  status?: "all" | PaymentStatus;
  month?: string; // "YYYY-MM"
}): Promise<{
  orders: OrderListItem[];
  total: number;
  paidCount: number;
  collectedByStaffCount: number;
  unpaidCount: number;
}> {
  const { search, limit, offset, status = "all", month } = params;
  const like = `%${search.trim()}%`;

  const conditions: string[] = [];
  const whereArgs: unknown[] = [];
  if (search.trim()) {
    conditions.push(
      "(o.falco_code LIKE ? OR o.awb LIKE ? OR o.recipient_name LIKE ? OR o.recipient_phone LIKE ?)"
    );
    whereArgs.push(like, like, like, like);
  }
  if (month) {
    conditions.push("DATE_FORMAT(o.received_date, '%Y-%m') = ?");
    whereArgs.push(month);
  }
  if (status === "paid" || status === "unpaid" || status === "collected_by_staff") {
    conditions.push("o.payment_status = ?");
    whereArgs.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await getPool().query(
    `SELECT o.*, COUNT(p.id) AS parcel_count
     FROM orders o
     LEFT JOIN order_parcels p ON p.order_id = o.id
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

  // Đếm riêng theo trạng thái thu tiền (không áp bộ lọc status, chỉ áp tìm
  // kiếm + tháng) để hiển thị số lượng trên các tab lọc.
  const searchMonthConditions: string[] = [];
  const searchMonthArgs: unknown[] = [];
  if (search.trim()) {
    searchMonthConditions.push(
      "(o.falco_code LIKE ? OR o.awb LIKE ? OR o.recipient_name LIKE ? OR o.recipient_phone LIKE ?)"
    );
    searchMonthArgs.push(like, like, like, like);
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
  let unpaidCount = 0;
  for (const r of statusRows as { payment_status: PaymentStatus; c: number }[]) {
    if (r.payment_status === "paid") paidCount = r.c;
    else if (r.payment_status === "collected_by_staff") collectedByStaffCount = r.c;
    else unpaidCount = r.c;
  }

  return {
    orders: rows as OrderListItem[],
    total,
    paidCount,
    collectedByStaffCount,
    unpaidCount,
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
