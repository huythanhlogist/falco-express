/**
 * Script chạy 1 lần: tạo bảng `order_tracking_cache` — lưu trạng thái vận
 * chuyển mới nhất của từng đơn (lấy từ Kango, cập nhật mỗi ngày 1 lần bởi
 * /api/cron/refresh-tracking) để trang tra cứu công khai và cột "Vận chuyển"
 * ở admin đọc thẳng từ DB thay vì gọi Kango mỗi lượt. Dùng IF NOT EXISTS nên
 * chạy lại nhiều lần vẫn an toàn.
 *
 * fetched_at là epoch mili-giây do Node ghi (không dùng NOW() của MySQL vì
 * đồng hồ server DB Hostinger lệch ~7h so với giờ thật).
 *
 *   npx tsx scripts/setup-tracking-cache-table.ts
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
    `CREATE TABLE IF NOT EXISTS order_tracking_cache (
      order_id INT NOT NULL PRIMARY KEY,
      awb VARCHAR(20) NOT NULL,
      shipment_status ENUM('imported','in_transit','customs','delivered','returned') NOT NULL DEFAULT 'imported',
      current_status VARCHAR(255) NULL,
      payload MEDIUMTEXT NULL,
      fetched_at BIGINT NOT NULL,
      last_error VARCHAR(255) NULL,
      CONSTRAINT fk_order_tracking_cache_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`
  );
  console.log("OK: order_tracking_cache table ready");

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
