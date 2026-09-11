/**
 * Script chạy 1 lần: mở rộng bảng `orders` sẵn có để hỗ trợ đơn do CTV tạo
 * (phase 2 của tính năng CTV — xem .claude/plans lịch sử phát triển).
 * Dùng ADD COLUMN IF NOT EXISTS nên chạy lại nhiều lần vẫn an toàn. Đơn cũ
 * (Kango import, đơn nhân viên tạo trước đây) giữ nguyên giá trị mặc định
 * của các cột mới (source='staff', review_status='auto_approved') — không
 * ảnh hưởng gì tới dữ liệu/luồng hiện có.
 *
 *   npx tsx scripts/alter-orders-for-ctv.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import mysql from "mysql2/promise";

const STATEMENTS = [
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(8,2) NULL`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS source ENUM('staff','ctv') NOT NULL DEFAULT 'staff'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS ctv_id INT NULL`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_status ENUM('auto_approved','pending','approved','rejected') NOT NULL DEFAULT 'auto_approved'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255) NULL`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL`,
  `ALTER TABLE orders MODIFY COLUMN payment_status
    ENUM('unpaid','collected_by_staff','collected_by_ctv','paid') NOT NULL DEFAULT 'unpaid'`,
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  for (const sql of STATEMENTS) {
    await conn.query(sql);
    console.log("OK:", sql.trim().split("\n")[0]);
  }

  // FK riêng — bỏ qua nếu đã tồn tại (chạy lại script không lỗi).
  try {
    await conn.query(
      `ALTER TABLE orders ADD CONSTRAINT fk_orders_ctv FOREIGN KEY (ctv_id) REFERENCES ctv_users(id) ON DELETE SET NULL`
    );
    console.log("OK: added fk_orders_ctv");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Duplicate") || msg.includes("errno: 121") || msg.includes("already exists")) {
      console.log("SKIP: fk_orders_ctv already exists");
    } else {
      throw err;
    }
  }

  await conn.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
