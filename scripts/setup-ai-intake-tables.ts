import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { getPool } from "../src/lib/db";

async function main() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_intake_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      note TEXT NOT NULL,
      status ENUM('pending', 'processed') NOT NULL DEFAULT 'pending',
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_intake_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_size INT NOT NULL,
      data LONGBLOB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES ai_intake_orders(id) ON DELETE CASCADE
    )
  `);

  console.log("Đã tạo xong bảng ai_intake_orders + ai_intake_images.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
