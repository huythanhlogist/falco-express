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
