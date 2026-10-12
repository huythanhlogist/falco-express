/**
 * Script chạy 1 lần: thêm cột `collected_date` (DATE, NULL) vào bảng `orders`
 * — ngày thu tiền khách của từng đơn, để trang Kế toán biết đơn nào thu vào
 * ngày nào. Tự điền khi trạng thái thu đổi sang đã thu/thu hộ (xem
 * updateOrder trong src/lib/db.ts), sửa tay được. Đơn cũ để NULL. Dùng
 * ADD COLUMN IF NOT EXISTS nên chạy lại nhiều lần vẫn an toàn.
 *
 *   npx tsx scripts/alter-orders-add-collected-date.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS collected_date DATE NULL`);
  console.log("OK: added collected_date column");

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
