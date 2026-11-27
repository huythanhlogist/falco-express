/**
 * Script chạy 1 lần: tạo bảng `shipment_notify_events` — ghi nhận các mốc
 * vận chuyển và cảnh báo đã phát hiện cho từng đơn để trả tin nhắn thông báo
 * Zalo (qua n8n), tránh gửi trùng bằng UNIQUE(order_id, kind). Dùng
 * IF NOT EXISTS nên chạy lại nhiều lần vẫn an toàn.
 *
 *   npx tsx scripts/setup-shipment-notify-table.ts
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
    `CREATE TABLE IF NOT EXISTS shipment_notify_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      kind VARCHAR(32) NOT NULL,
      lot_date DATE NULL,
      event_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notified_at DATETIME NULL,
      UNIQUE KEY uq_shipment_notify_order_kind (order_id, kind),
      INDEX idx_shipment_notify_pending (notified_at, kind),
      INDEX idx_shipment_notify_lot (lot_date),
      CONSTRAINT fk_shipment_notify_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`
  );
  console.log("OK: shipment_notify_events table ready");

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
