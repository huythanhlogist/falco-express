/**
 * Script chạy 1 lần để tạo bảng MySQL cho tính năng tài khoản CTV
 * (cộng tác viên). Dùng IF NOT EXISTS nên chạy lại nhiều lần vẫn an toàn.
 *
 *   npx tsx scripts/setup-ctv-tables.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
// Máy dev đôi khi phân giải DB_HOST ra IPv6 trước, trong khi MySQL Hostinger
// chỉ cho phép IPv4 truy cập từ xa — ép ưu tiên IPv4 để script chạy ổn định
// khi gọi từ máy cá nhân (trên server thật DB_HOST=localhost nên không gặp
// vấn đề này).
dns.setDefaultResultOrder("ipv4first");
import mysql from "mysql2/promise";

const DDL = [
  `CREATE TABLE IF NOT EXISTS ctv_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    ctv_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    cccd_number VARCHAR(20) NOT NULL,
    referred_by_ctv_id INT NULL,
    commission_pct DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    referral_override_pct DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    contact_name VARCHAR(255) NULL,
    contact_phone VARCHAR(50) NULL,
    contact_zalo_href VARCHAR(500) NULL,
    status ENUM('active','disabled') NOT NULL DEFAULT 'active',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (referred_by_ctv_id) REFERENCES ctv_users(id) ON DELETE SET NULL
  )`,
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  for (const sql of DDL) {
    await conn.query(sql);
    console.log("OK:", sql.trim().split("\n")[0]);
  }
  await conn.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
