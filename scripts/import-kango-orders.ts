/**
 * Nhập đơn hàng mới từ file "ListShipment" Kango xuất định kỳ.
 *
 * Cách chạy:
 *   npm run import:kango -- /duong/dan/ListShipment.xlsx
 *
 * File Kango xuất ra có các cột cố định (theo mẫu thực tế):
 *   AWB, HAWB, TRACKING NUMBER, SERVICE, DATE, COMPANY, CONTACT,
 *   ADDRESS 1-3, CITY, STATE/PROVINCE, COUNTRY, POSTAL CODE, TELEPHONE, ...
 *
 * Một bill (AWB) có thể có 2-3 kiện: dòng đầu tiên của bill có ô AWB, các
 * dòng kiện tiếp theo của CÙNG bill đó để trống ô AWB (nhưng vẫn có
 * TRACKING NUMBER riêng) — script gộp các dòng liền kề có AWB trống vào
 * bill của dòng AWB gần nhất phía trên.
 *
 * File Kango xuất theo tháng nên các lần xuất sau sẽ trùng lặp AWB của lần
 * trước — script bỏ qua AWB đã có sẵn.
 *
 * Từ khi có API tracking chính thức của Kango, MySQL là nguồn dữ liệu
 * CHÍNH (web đọc từ đây để gọi API Kango). Google Sheet chỉ còn là bản
 * mirror để tải file Excel tổng hợp khi cần — không còn được web đọc.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { appendOrders, type OrderRow } from "../src/lib/sheets";
import {
  insertOrder,
  insertParcels,
  listAwbSet,
  listFalcoCodeSet,
} from "../src/lib/db";

// Vị trí cột trong file Kango xuất ra (0-indexed). Nếu Kango đổi cấu trúc
// cột, chỉ cần sửa các số bên dưới cho khớp.
const COL = {
  AWB: 8,
  TRACKING_NUMBER: 10,
  SERVICE: 11,
  DATE: 13,
  CONTACT: 15,
  CITY: 19,
  COUNTRY: 21,
  TELEPHONE: 23,
} as const;

type ShipmentGroup = {
  awb: string;
  service: string;
  date: string; // dd/mm/yyyy — để mirror sang Sheet
  dateIso: string | null; // yyyy-mm-dd — để ghi vào MySQL
  contact: string;
  telephone: string;
  city: string;
  country: string;
  trackingNumbers: string[];
};

/**
 * Chuyển giá trị ô Excel thành chuỗi an toàn. Bắt buộc phải đọc sheet với
 * `raw: true` và dùng hàm này cho MỌI cột số (AWB, TRACKING NUMBER...) —
 * nếu dùng `raw: false`, SheetJS format số nguyên dài (>11 chữ số) theo
 * kiểu "General" của Excel và trả về dạng khoa học méo mó (vd
 * "1.5503E+13"), làm mất số/trùng dữ liệu giữa các kiện khác nhau. Các mã
 * tracking 14 chữ số trong dữ liệu Kango vẫn nằm trong giới hạn số nguyên
 * an toàn của JS (Number.isSafeInteger) nên String(number) không mất độ
 * chính xác.
 */
function cellToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

function excelDateToVN(raw: string): string {
  // File Kango xuất ngày dạng dd-mm-yyyy, chuyển sang dd/mm/yyyy cho quen thuộc.
  const m = raw.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : raw.trim();
}

function excelDateToISO(raw: string): string | null {
  // MySQL DATE cần dạng YYYY-MM-DD.
  const m = raw.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function groupRowsByAwb(rows: unknown[][]): ShipmentGroup[] {
  const groups: ShipmentGroup[] = [];
  let current: ShipmentGroup | null = null;

  for (const row of rows) {
    const awb = cellToString(row[COL.AWB]);
    const tracking = cellToString(row[COL.TRACKING_NUMBER]);

    if (awb) {
      const rawDate = cellToString(row[COL.DATE]);
      current = {
        awb,
        service: cellToString(row[COL.SERVICE]),
        date: excelDateToVN(rawDate),
        dateIso: excelDateToISO(rawDate),
        contact: cellToString(row[COL.CONTACT]),
        telephone: cellToString(row[COL.TELEPHONE]),
        city: cellToString(row[COL.CITY]),
        country: cellToString(row[COL.COUNTRY]),
        trackingNumbers: tracking ? [tracking] : [],
      };
      groups.push(current);
    } else if (current && tracking) {
      // Dòng kiện tiếp theo của cùng bill phía trên (không có AWB riêng).
      current.trackingNumbers.push(tracking);
    }
  }

  return groups;
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
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  if (rows.length < 2) {
    console.log("File không có dữ liệu.");
    return;
  }

  const groups = groupRowsByAwb(rows.slice(1));
  console.log(
    `Đọc được ${groups.length} bill (${rows.length - 1} dòng) từ file.`
  );

  console.log("Đang tải danh sách đơn hàng hiện có từ MySQL...");
  const existingAwb = await listAwbSet();
  const existingFalcoCodes = await listFalcoCodeSet();

  const sheetMirrorRows: OrderRow[] = [];
  let inserted = 0;
  let skipped = 0;

  for (const g of groups) {
    if (existingAwb.has(g.awb.toUpperCase())) {
      skipped += 1;
      continue;
    }

    const falcoCode = nextFalcoCode(existingFalcoCodes);
    existingFalcoCodes.add(falcoCode);
    existingAwb.add(g.awb.toUpperCase());

    const destination = [g.city, g.country].filter(Boolean).join(", ");

    const orderId = await insertOrder({
      falcoCode,
      awb: g.awb,
      recipientName: g.contact,
      recipientPhone: g.telephone,
      service: g.service,
      destination,
      receivedDate: g.dateIso,
    });
    await insertParcels(
      orderId,
      g.trackingNumbers.map((code) => ({ hawb: "", trackingCode: code }))
    );
    inserted += 1;

    sheetMirrorRows.push({
      falcoCode,
      billNumber: g.awb,
      recipientName: g.contact,
      recipientPhone: g.telephone,
      service: g.service,
      destination,
      lastMileCodes: g.trackingNumbers.join(", "),
      receivedDate: g.date,
      warehouseDate: "",
      handoverDate: "",
      deliveredDate: "",
    });
  }

  if (inserted === 0) {
    console.log(`Không có bill mới. Đã bỏ qua ${skipped} bill trùng lặp.`);
    return;
  }

  console.log(`Đã thêm ${inserted} bill mới vào MySQL. Bỏ qua ${skipped} bill trùng lặp.`);

  try {
    await appendOrders(sheetMirrorRows);
    console.log("Đã mirror sang Google Sheet để tải Excel khi cần.");
  } catch (err) {
    console.error(
      "Cảnh báo: ghi MySQL thành công nhưng mirror sang Sheet thất bại:",
      err instanceof Error ? err.message : err
    );
  }

  console.log("Mã Falco mới:", sheetMirrorRows.map((r) => r.falcoCode).join(", "));
}

main().catch((err) => {
  console.error("Lỗi khi nhập liệu:", err);
  process.exit(1);
});
