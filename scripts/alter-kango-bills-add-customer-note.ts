/**
 * Thêm cột kango_bills.customer_note (ghi chú cho khách, in lên mặt bill —
 * chỉ lưu nội bộ, KHÔNG gửi lên Kango). Idempotent (kiểm tra INFORMATION_SCHEMA trước).
 *
 *   npx tsx scripts/alter-kango-bills-add-customer-note.ts
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
  try {
    const [cols] = await c.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'kango_bills'
         AND COLUMN_NAME = 'customer_note'`
    );
    if ((cols as unknown[]).length === 0) {
      await c.query("ALTER TABLE kango_bills ADD COLUMN customer_note TEXT NULL");
      console.log("Đã thêm cột customer_note");
    } else {
      console.log("Cột customer_note đã có");
    }
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
