/**
 * Tạo bảng ctv_tracking_sites (trang tra cứu thương hiệu riêng của CTV, /t/<slug>).
 * Idempotent: chạy lại nhiều lần vẫn an toàn.
 *
 *   npx tsx scripts/setup-ctv-tracking-sites.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import mysql from "mysql2/promise";

const DDL = `CREATE TABLE IF NOT EXISTS ctv_tracking_sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ctv_id INT NOT NULL UNIQUE,
  slug VARCHAR(40) NOT NULL UNIQUE,
  display_name VARCHAR(80) NOT NULL DEFAULT '',
  layout VARCHAR(20) NOT NULL DEFAULT 'classic',
  color VARCHAR(20) NOT NULL DEFAULT 'ocean',
  custom_color VARCHAR(7) NULL,
  zalo VARCHAR(255) NULL,
  whatsapp VARCHAR(255) NULL,
  facebook VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  address VARCHAR(255) NULL,
  logo_data MEDIUMBLOB NULL,
  logo_type VARCHAR(50) NULL,
  banner_data MEDIUMBLOB NULL,
  banner_type VARCHAR(50) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cts_ctv FOREIGN KEY (ctv_id) REFERENCES ctv_users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4`;

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await conn.query(DDL);
  console.log("OK: ctv_tracking_sites");
  await conn.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
