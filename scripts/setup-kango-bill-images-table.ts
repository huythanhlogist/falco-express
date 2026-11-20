import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { getPool } from "../src/lib/db";

async function main() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kango_bill_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bill_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_size INT NOT NULL,
      data LONGBLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_kango_bill_images_bill_id (bill_id),
      FOREIGN KEY (bill_id) REFERENCES kango_bills(id) ON DELETE CASCADE
    )
  `);

  console.log("Đã tạo xong bảng kango_bill_images.");
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
