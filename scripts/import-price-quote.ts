/**
 * Nhập/cập nhật bảng giá từ file Excel gốc Kango — dùng CHUNG logic parser
 * với tab "Upload bảng giá Kango" trong admin (src/lib/price-quote-import.ts),
 * để chạy CLI 1 lần khi cần (vd lúc khởi tạo dữ liệu ban đầu) mà không cần
 * đăng nhập web.
 *
 * Cách chạy:
 *   npm run import:price-quote -- "/duong/dan/PRICE ... .xlsx"
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import dns from "node:dns";
// Máy dev đôi khi phân giải DB_HOST ra IPv6 trước, trong khi MySQL Hostinger
// chỉ cho phép IPv4 truy cập từ xa — ép ưu tiên IPv4 để script chạy ổn định
// khi gọi từ máy cá nhân (trên server thật DB_HOST=localhost nên không gặp
// vấn đề này).
dns.setDefaultResultOrder("ipv4first");
import { parseKangoPriceWorkbook } from "../src/lib/price-quote-import";
import { replaceAllPriceQuoteCategories } from "../src/lib/db";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Cách dùng: npm run import:price-quote -- "/duong/dan/file.xlsx"');
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  console.log("Đang đọc file...");
  const result = parseKangoPriceWorkbook(buffer);

  if (result.errors.length > 0) {
    console.log("File không đúng định dạng — CHƯA cập nhật gì cả:");
    for (const err of result.errors) console.log(" -", err);
    process.exit(1);
  }

  const totalLines = result.categories.reduce((sum, c) => sum + c.lines.length, 0);
  await replaceAllPriceQuoteCategories(result.categories, {
    sourceFileName: filePath.split("/").pop() || filePath,
    uploadedBy: "cli-script",
  });

  console.log(`Đã cập nhật ${result.categories.length} nhóm giá / ${totalLines} dòng giá.`);
  for (const c of result.categories) {
    console.log(` - ${c.title}: ${c.lines.map((l) => l.title).join(", ")}`);
  }
  if (result.warnings.length > 0) {
    console.log("Cảnh báo:");
    for (const w of result.warnings) console.log(" -", w);
  }
}

main().catch((err) => {
  console.error("Lỗi khi nhập bảng giá:", err);
  process.exit(1);
});
