/**
 * Thêm cột orders.recipient_postcode (mã bưu chính người nhận) — dùng để tra tracking
 * DPD/DHL… ở khâu nội bộ; KHÔNG hiển thị công khai. Idempotent.
 *
 *   npx tsx scripts/alter-orders-add-recipient-postcode.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
import mysql from "mysql2/promise";

async function main() {
  const { address } = await dns.promises.lookup(process.env.DB_HOST!, { family: 4 });
  const c = await mysql.createConnection({
    host: address,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [cols] = await c.query("SHOW COLUMNS FROM orders LIKE 'recipient_postcode'");
  if ((cols as unknown[]).length === 0) {
    await c.query("ALTER TABLE orders ADD COLUMN recipient_postcode VARCHAR(20) NULL AFTER recipient_phone");
    console.log("Đã thêm cột recipient_postcode");
  } else {
    console.log("Cột recipient_postcode đã có");
  }
  await c.end();
}
main();
