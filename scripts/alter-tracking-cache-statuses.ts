/**
 * Script chạy 1 lần: mở rộng ENUM `shipment_status` của order_tracking_cache cho các mốc
 * mới (received, exported, customs_processing, customs_released, last_mile). Giữ lại
 * in_transit/customs cũ để các dòng hiện có không lỗi cho tới khi chạy
 * scripts/recompute-shipment-status.ts. Chạy lại nhiều lần vẫn an toàn.
 *
 *   npx tsx scripts/alter-tracking-cache-statuses.ts
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
    `ALTER TABLE order_tracking_cache MODIFY shipment_status
     ENUM('imported','received','exported','customs_processing','customs_released','last_mile','delivered','returned','in_transit','customs')
     NOT NULL DEFAULT 'imported'`
  );
  console.log("OK: shipment_status enum updated");
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
