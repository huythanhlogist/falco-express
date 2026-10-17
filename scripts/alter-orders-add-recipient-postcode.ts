/**
 * Script chạy 1 lần: thêm cột `recipient_postcode` vào bảng `orders` — mã bưu
 * chính người nhận. Trang tra cứu vận đơn công khai chỉ hiện tên người nhận
 * đã che; khách nhập đúng postcode này thì mới xem được thông tin đầy đủ
 * (xem src/lib/tracking-privacy.ts). Nhập/sửa ở form sửa đơn trong
 * /admin/orders. Khi cột này trống, trang tra cứu thử dùng postcode của bill
 * đã gửi trong bảng kango_bills (khớp theo AWB/HAWB) — cần kiểm tra lại trên
 * dữ liệu thật xem mã bill Kango có trùng AWB trong file ListShipment không.
 * Dùng ADD COLUMN IF NOT EXISTS nên chạy lại nhiều lần vẫn an toàn.
 *
 *   npx tsx scripts/alter-orders-add-recipient-postcode.ts
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

  await conn.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_postcode VARCHAR(20) NULL`);
  console.log("OK: added recipient_postcode column");

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
