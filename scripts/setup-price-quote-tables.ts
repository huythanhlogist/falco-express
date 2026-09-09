/**
 * Script chạy 1 lần để tạo 3 bảng MySQL cho tính năng "Báo giá" ở admin
 * (price_quote_categories, price_quote_lines, price_quote_policy_items).
 * Dùng IF NOT EXISTS nên chạy lại nhiều lần vẫn an toàn.
 *
 *   npx tsx scripts/setup-price-quote-tables.ts
 */
import mysql from "mysql2/promise";

const DDL = [
  `CREATE TABLE IF NOT EXISTS price_quote_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    note VARCHAR(500),
    source_file_name VARCHAR(255),
    uploaded_by VARCHAR(255),
    uploaded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS price_quote_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL,
    countries VARCHAR(500),
    min_weight_kg DECIMAL(6,1),
    markup_flat_vnd INT NOT NULL,
    markup_per_kg_vnd INT NOT NULL,
    rows_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES price_quote_categories(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS price_quote_policy_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    position INT NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
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
