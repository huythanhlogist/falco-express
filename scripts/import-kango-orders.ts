/**
 * Nhập đơn hàng mới từ file Excel Kango xuất định kỳ vào Google Sheet.
 *
 * Cách chạy:
 *   npm run import:kango -- /duong/dan/file.xlsx
 *
 * File Excel cần có các cột (tên cột không phân biệt hoa/thường, có thể
 * lệch thứ tự — script tự dò theo tên cột):
 *   - AWB (mã dùng để tra cứu trên KSN Post / bill number)
 *   - Tên khách hàng
 *   - Số điện thoại
 *   - Nước đến
 *   - Hãng vận chuyển last-mile (DHL/UPS)
 *   - Mã tracking last-mile
 *
 * Script sẽ:
 *   1. Đọc toàn bộ đơn đã có trong Google Sheet để biết AWB nào đã tồn tại.
 *   2. Bỏ qua các dòng trong file Excel có AWB đã có trong Sheet (khử trùng
 *      lặp do file Kango xuất theo tháng).
 *   3. Với AWB mới: tự sinh Mã Falco kế tiếp, append vào Sheet.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { appendOrders, getAllOrders, type OrderRow } from "../src/lib/sheets";

const COLUMN_ALIASES: Record<keyof RawColumns, string[]> = {
  awb: ["awb", "mã awb", "ma awb", "awb number", "tracking", "mã bill", "so bill"],
  customerName: ["tên khách hàng", "ten khach hang", "customer name", "khách hàng"],
  customerPhone: ["số điện thoại", "so dien thoai", "phone", "sđt", "sdt"],
  destination: ["nước đến", "nuoc den", "destination", "quốc gia", "country"],
  carrier: ["hãng vận chuyển", "hang van chuyen", "carrier", "hãng last-mile"],
  lastMileCode: [
    "mã tracking last-mile",
    "ma tracking last-mile",
    "last mile tracking",
    "mã tracking",
    "tracking number",
  ],
};

type RawColumns = {
  awb: string;
  customerName: string;
  customerPhone: string;
  destination: string;
  carrier: string;
  lastMileCode: string;
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function nextFalcoCode(existingCodes: Set<string>): string {
  const today = new Date();
  const y = String(today.getFullYear()).slice(2);
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `FL${y}${m}${d}`;

  let seq = 1;
  let code = `${prefix}${String(seq).padStart(3, "0")}`;
  while (existingCodes.has(code)) {
    seq += 1;
    code = `${prefix}${String(seq).padStart(3, "0")}`;
  }
  return code;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Cách dùng: npm run import:kango -- /duong/dan/file.xlsx");
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  if (rows.length < 2) {
    console.log("File không có dữ liệu.");
    return;
  }

  const headers = rows[0];
  const colIndex: Record<keyof RawColumns, number> = {
    awb: findColumnIndex(headers, COLUMN_ALIASES.awb),
    customerName: findColumnIndex(headers, COLUMN_ALIASES.customerName),
    customerPhone: findColumnIndex(headers, COLUMN_ALIASES.customerPhone),
    destination: findColumnIndex(headers, COLUMN_ALIASES.destination),
    carrier: findColumnIndex(headers, COLUMN_ALIASES.carrier),
    lastMileCode: findColumnIndex(headers, COLUMN_ALIASES.lastMileCode),
  };

  if (colIndex.awb === -1) {
    console.error(
      "Không tìm thấy cột mã AWB trong file. Các cột đọc được:",
      headers
    );
    console.error(
      "Sửa COLUMN_ALIASES.awb trong scripts/import-kango-orders.ts cho khớp tên cột thật."
    );
    process.exit(1);
  }

  console.log("Đang tải danh sách đơn hàng hiện có từ Google Sheet...");
  const existingOrders = await getAllOrders();
  const existingBillNumbers = new Set(
    existingOrders.map((o) => o.billNumber.trim().toUpperCase())
  );
  const existingFalcoCodes = new Set(
    existingOrders.map((o) => o.falcoCode.trim().toUpperCase())
  );

  const newRows: OrderRow[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const awb = (row[colIndex.awb] || "").toString().trim();
    if (!awb) continue;

    if (existingBillNumbers.has(awb.toUpperCase())) {
      skipped += 1;
      continue;
    }

    const falcoCode = nextFalcoCode(existingFalcoCodes);
    existingFalcoCodes.add(falcoCode);
    existingBillNumbers.add(awb.toUpperCase());

    newRows.push({
      falcoCode,
      billNumber: awb,
      customerName:
        colIndex.customerName !== -1 ? (row[colIndex.customerName] || "").toString().trim() : "",
      customerPhone:
        colIndex.customerPhone !== -1 ? (row[colIndex.customerPhone] || "").toString().trim() : "",
      service: "Quốc tế",
      destination:
        colIndex.destination !== -1 ? (row[colIndex.destination] || "").toString().trim() : "",
      lastMileCarrier:
        colIndex.carrier !== -1 ? (row[colIndex.carrier] || "").toString().trim() : "",
      lastMileCodes:
        colIndex.lastMileCode !== -1 ? (row[colIndex.lastMileCode] || "").toString().trim() : "",
      receivedDate: new Date().toLocaleDateString("vi-VN"),
      warehouseDate: "",
      handoverDate: "",
      deliveredDate: "",
      note: "",
    });
  }

  if (newRows.length === 0) {
    console.log(`Không có đơn mới. Đã bỏ qua ${skipped} đơn trùng lặp.`);
    return;
  }

  await appendOrders(newRows);
  console.log(
    `Đã thêm ${newRows.length} đơn mới vào Google Sheet. Bỏ qua ${skipped} đơn trùng lặp.`
  );
  console.log("Mã Falco mới:", newRows.map((r) => r.falcoCode).join(", "));
}

main().catch((err) => {
  console.error("Lỗi khi nhập liệu:", err);
  process.exit(1);
});
