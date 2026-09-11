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
  `CREATE TABLE IF NOT EXISTS ctv_content_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kind ENUM('guide','channel') NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  // Hoa hồng tính ĐỘNG từ orders + ctv_users mỗi lần xem (xem
  // getCtvCommissionSummary trong src/lib/db.ts) — ctv_payouts là dữ kiện
  // DUY NHẤT không thể tính lại được (đã trả thật hay chưa), nên là bảng sổ
  // cố định duy nhất cần lưu.
  `CREATE TABLE IF NOT EXISTS ctv_payouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ctv_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    note VARCHAR(500) NULL,
    paid_by VARCHAR(255) NOT NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ctv_id) REFERENCES ctv_users(id) ON DELETE CASCADE
  )`,
  // Xác nhận CTV đã nộp lại tiền thu hộ khách cho Falco (ngược chiều với
  // ctv_payouts) — 1 order chỉ có tối đa 1 dòng xác nhận.
  `CREATE TABLE IF NOT EXISTS ctv_remittances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    ctv_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    note VARCHAR(500) NULL,
    remitted_to VARCHAR(255) NOT NULL,
    remitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (ctv_id) REFERENCES ctv_users(id) ON DELETE CASCADE
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
