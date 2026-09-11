/**
 * Script chạy 1 lần để tạo bảng MySQL cho tính năng "Tạo bill" (khởi tạo
 * shipment gửi lên API Kango https://kango-post.com/api/create-bill).
 * Dùng IF NOT EXISTS nên chạy lại nhiều lần vẫn an toàn.
 *
 *   npx tsx scripts/setup-kango-bills-table.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import mysql from "mysql2/promise";

const DDL = [
  `CREATE TABLE IF NOT EXISTS kango_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receiver_company_name VARCHAR(255) NOT NULL,
    receiver_contact_name VARCHAR(255) NOT NULL,
    receiver_telephone VARCHAR(50) NOT NULL,
    receiver_country VARCHAR(255) NOT NULL,
    receiver_state_name VARCHAR(255) NOT NULL,
    receiver_city VARCHAR(255) NOT NULL,
    receiver_postal_code VARCHAR(50) NOT NULL,
    receiver_address_1 VARCHAR(255) NOT NULL,
    receiver_address_2 VARCHAR(255) NULL,
    receiver_address_3 VARCHAR(255) NULL,
    shipment_service VARCHAR(100) NOT NULL,
    shipment_signature_flg TINYINT(1) NOT NULL DEFAULT 1,
    shipment_branch VARCHAR(10) NOT NULL,
    shipment_reference_code VARCHAR(255) NULL,
    shipment_goods_name VARCHAR(255) NOT NULL,
    shipment_value DECIMAL(12,2) NOT NULL,
    shipment_export_as TINYINT NOT NULL DEFAULT 0,
    packages_json TEXT NOT NULL,
    invoices_json TEXT NULL,
    status ENUM('draft','sent') NOT NULL DEFAULT 'draft',
    kango_bill_id VARCHAR(50) NULL,
    kango_hawbs_json TEXT NULL,
    kango_redirect_url VARCHAR(500) NULL,
    send_error TEXT NULL,
    created_by VARCHAR(255) NOT NULL,
    sent_by VARCHAR(255) NULL,
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
