/**
 * Nhập đơn hàng mới từ file "ListShipment" Kango xuất định kỳ.
 *
 * Cách chạy:
 *   npm run import:kango -- /duong/dan/ListShipment.xlsx
 *
 * Logic đọc file / gộp bill / thêm mới / cập nhật bill đã có nằm chung ở
 * src/lib/kango-import.ts — dùng chung với tab "Upload tài liệu" trong
 * admin, để nhân viên cũng có thể tự upload trực tiếp trên web thay vì cần
 * chạy script này.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { processKangoWorkbook } from "../src/lib/kango-import";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Cách dùng: npm run import:kango -- /duong/dan/file.xlsx");
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  console.log("Đang xử lý file...");
  const result = await processKangoWorkbook(buffer);

  console.log(`Đọc được ${result.totalBills} bill từ file.`);
  console.log(
    `Đã thêm ${result.inserted} bill mới, cập nhật ${result.updated} bill đã có (điền thêm thông tin/mã tracking), ${result.unchanged} bill không đổi gì.`
  );
  if (result.insertedCodes.length > 0) {
    console.log("Mã Falco mới:", result.insertedCodes.join(", "));
  }
  if (result.errors.length > 0) {
    console.log("Cảnh báo/lỗi:");
    for (const err of result.errors) console.log(" -", err);
  }
}

main().catch((err) => {
  console.error("Lỗi khi nhập liệu:", err);
  process.exit(1);
});
