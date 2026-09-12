import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { getPool } from "../src/lib/db";

async function main() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dbn_quotes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(50) NULL,
      customer_email VARCHAR(255) NULL,
      quote_date DATE NOT NULL,
      rows_json TEXT NOT NULL,
      total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      image LONGBLOB NULL,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Đã tạo xong bảng dbn_quotes.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
