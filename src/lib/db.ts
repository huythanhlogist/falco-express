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

export type OrderRecord = {
  id: number;
  falco_code: string;
  awb: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  service: string | null;
  destination: string | null;
  received_date: string | null;
  payment_status: "unpaid" | "paid";
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
  status?: "all" | "paid" | "unpaid";
}): Promise<{ orders: OrderListItem[]; total: number; paidCount: number; unpaidCount: number }> {
  const { search, limit, offset, status = "all" } = params;
  const like = `%${search.trim()}%`;

  const conditions: string[] = [];
  const whereArgs: unknown[] = [];
  if (search.trim()) {
    conditions.push(
      "(o.falco_code LIKE ? OR o.awb LIKE ? OR o.recipient_name LIKE ? OR o.recipient_phone LIKE ?)"
    );
    whereArgs.push(like, like, like, like);
  }
  if (status === "paid" || status === "unpaid") {
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

  // Đếm riêng theo trạng thái thanh toán (không áp bộ lọc status, chỉ áp
  // tìm kiếm) để hiển thị số lượng trên các tab lọc.
  const searchOnlyWhere = search.trim()
    ? "WHERE o.falco_code LIKE ? OR o.awb LIKE ? OR o.recipient_name LIKE ? OR o.recipient_phone LIKE ?"
    : "";
  const searchOnlyArgs = search.trim() ? [like, like, like, like] : [];
  const [statusRows] = await getPool().query(
    `SELECT payment_status, COUNT(*) AS c FROM orders o ${searchOnlyWhere} GROUP BY payment_status`,
    searchOnlyArgs
  );
  let paidCount = 0;
  let unpaidCount = 0;
  for (const r of statusRows as { payment_status: "paid" | "unpaid"; c: number }[]) {
    if (r.payment_status === "paid") paidCount = r.c;
    else unpaidCount = r.c;
  }

  return { orders: rows as OrderListItem[], total, paidCount, unpaidCount };
}

export async function updatePaymentStatus(
  id: number,
  status: "paid" | "unpaid"
): Promise<boolean> {
  const [result] = await getPool().query(
    "UPDATE orders SET payment_status = ? WHERE id = ?",
    [status, id]
  );
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
