/**
 * Script chạy 1 lần: thêm cột `chi_source_invoice` vào bảng `orders` — đánh
 * dấu giá trị CHI hiện tại của đơn đến từ hoá đơn DBN nào (Upload DBN ở
 * trang Kế toán), để lần upload sau nhận biết được đâu là ghi đè cùng 1 hoá
 * đơn (Kango gửi lại bản bổ sung) vs. đơn đã có CHI nhập tay/nguồn khác
 * (không tự động ghi đè). Dùng ADD COLUMN IF NOT EXISTS nên chạy lại nhiều
 * lần vẫn an toàn.
 *
 *   npx tsx scripts/alter-orders-add-chi-source-invoice.ts
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

  await conn.query(
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS chi_source_invoice VARCHAR(50) NULL`
  );
  console.log("OK: added chi_source_invoice column");

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
