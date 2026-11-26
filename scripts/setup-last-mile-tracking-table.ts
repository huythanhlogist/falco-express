/**
 * Script chạy 1 lần: tạo bảng `order_last_mile_tracking` — lưu trạng thái
 * vận chuyển chặng cuối lấy trực tiếp từ API hãng (trước mắt là DHL Shipment
 * Tracking Unified API, cập nhật theo lịch cron /api/cron/refresh-last-mile)
 * phục vụ card "Hôm nay" và chuông cảnh báo ở trang Tổng quan admin.
 * Dùng IF NOT EXISTS nên chạy lại nhiều lần vẫn an toàn.
 *
 * Các mốc thời gian (last_event_at, delivered_at, estimated_delivery, fetched_at)
 * lưu dạng epoch mili-giây do Node ghi (không dùng NOW() của MySQL vì đồng hồ
 * server DB Hostinger lệch ~7h so với giờ thật).
 *
 *   npx tsx scripts/setup-last-mile-tracking-table.ts
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
    `CREATE TABLE IF NOT EXISTS order_last_mile_tracking (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      code VARCHAR(100) NOT NULL,
      carrier VARCHAR(32) NOT NULL DEFAULT 'DHL',
      status_code VARCHAR(32) NOT NULL DEFAULT 'unknown',
      status_text VARCHAR(255) NULL,
      last_event_at BIGINT NULL,
      delivered_at BIGINT NULL,
      estimated_delivery BIGINT NULL,
      failed TINYINT(1) NOT NULL DEFAULT 0,
      payload JSON NULL,
      fetched_at BIGINT NOT NULL,
      last_error VARCHAR(255) NULL,
      UNIQUE KEY uq_order_last_mile_order_code (order_id, code),
      INDEX idx_order_last_mile_carrier_status (carrier, status_code),
      INDEX idx_order_last_mile_delivered_at (delivered_at),
      INDEX idx_order_last_mile_fetched_at (fetched_at),
      CONSTRAINT fk_order_last_mile_tracking_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`
  );
  console.log("OK: order_last_mile_tracking table ready");

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
