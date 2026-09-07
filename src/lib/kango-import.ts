/**
 * Xử lý file "ListShipment" Kango xuất định kỳ — dùng chung cho cả script
 * CLI (scripts/import-kango-orders.ts) và tab "Upload tài liệu" trong admin
 * (src/app/api/admin/upload-orders/route.ts), để 2 nơi không lệch logic.
 *
 * File Kango xuất ra có các cột cố định (theo mẫu thực tế):
 *   AWB, HAWB, TRACKING NUMBER, SERVICE, DATE, COMPANY, CONTACT,
 *   ADDRESS 1-3, CITY, STATE/PROVINCE, COUNTRY, POSTAL CODE, TELEPHONE, ...
 *
 * Một bill (AWB) có thể có 2-3 kiện: dòng đầu tiên của bill có ô AWB, các
 * dòng kiện tiếp theo của CÙNG bill đó để trống ô AWB (nhưng vẫn có
 * TRACKING NUMBER riêng) — gộp các dòng liền kề có AWB trống vào bill của
 * dòng AWB gần nhất phía trên.
 *
 * File Kango xuất theo đợt nên các lần xuất sau sẽ trùng lặp AWB của lần
 * trước — với AWB đã có: chỉ ĐIỀN thêm vào các trường đang trống (vd mã
 * tracking chưa có ở lần trước) và mã tracking mới xuất hiện, KHÔNG ghi đè
 * dữ liệu đã có sẵn.
 *
 * MySQL là nguồn dữ liệu CHÍNH. Google Sheet chỉ là bản mirror để tải file
 * Excel tổng hợp khi cần (chỉ mirror bill MỚI, không mirror bill được cập
 * nhật vì Sheet không phải nơi web đọc dữ liệu).
 */
import * as XLSX from "xlsx";
import { appendOrders, type OrderRow } from "./sheets";
import {
  insertOrder,
  insertParcels,
  listAwbSet,
  listFalcoCodeSet,
  findOrderByAwb,
  listOrderParcels,
  replaceOrderParcels,
  updateOrder,
  type OrderEditableFields,
} from "./db";

// Vị trí cột trong file Kango xuất ra (0-indexed). Nếu Kango đổi cấu trúc
// cột, chỉ cần sửa các số bên dưới cho khớp — cả script CLI lẫn tab upload
// đều dùng chung file này.
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

export type KangoImportResult = {
  totalBills: number;
  inserted: number;
  updated: number;
  unchanged: number;
  insertedCodes: string[];
  errors: string[];
};

export async function processKangoWorkbook(
  buffer: Buffer
): Promise<KangoImportResult> {
  const empty: KangoImportResult = {
    totalBills: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    insertedCodes: [],
    errors: [],
  };

  let rows: unknown[][];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: "",
    });
  } catch {
    return {
      ...empty,
      errors: [
        "Không đọc được file — hãy chắc chắn đây là file Excel (.xlsx) đúng định dạng Kango xuất ra.",
      ],
    };
  }

  if (rows.length < 2) {
    return { ...empty, errors: ["File không có dữ liệu."] };
  }

  const groups = groupRowsByAwb(rows.slice(1));
  if (groups.length === 0) {
    return {
      ...empty,
      errors: [
        "Không tìm thấy bill nào — kiểm tra lại đúng file Kango xuất ra (cột cố định theo mẫu), chưa bị đổi cấu trúc cột.",
      ],
    };
  }

  const existingAwb = await listAwbSet();
  const existingFalcoCodes = await listFalcoCodeSet();

  const sheetMirrorRows: OrderRow[] = [];
  const insertedCodes: string[] = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const errors: string[] = [];

  for (const g of groups) {
    const destination = [g.city, g.country].filter(Boolean).join(", ");
    const awbUpper = g.awb.toUpperCase();

    if (existingAwb.has(awbUpper)) {
      try {
        const existing = await findOrderByAwb(g.awb);
        if (!existing) {
          unchanged += 1;
          continue;
        }

        // Chỉ điền vào các trường đang TRỐNG — không ghi đè dữ liệu admin
        // hoặc lần nhập trước đã có, vì lần nhập sau đôi khi thiếu thông tin.
        const fields: OrderEditableFields = {};
        if (!existing.recipient_name && g.contact) fields.recipientName = g.contact;
        if (!existing.recipient_phone && g.telephone) fields.recipientPhone = g.telephone;
        if (!existing.service && g.service) fields.service = g.service;
        if (!existing.destination && destination) fields.destination = destination;
        if (!existing.received_date && g.dateIso) fields.receivedDate = g.dateIso;

        let parcelsChanged = false;
        if (g.trackingNumbers.length > 0) {
          const existingParcels = await listOrderParcels(existing.id);
          const existingCodes = new Set(existingParcels.map((p) => p.tracking_code));
          const newCodes = g.trackingNumbers.filter((c) => !existingCodes.has(c));
          if (newCodes.length > 0) {
            const merged = [...existingParcels.map((p) => p.tracking_code), ...newCodes];
            await replaceOrderParcels(existing.id, merged);
            parcelsChanged = true;
          }
        }

        if (Object.keys(fields).length > 0) {
          await updateOrder(existing.id, fields);
        }

        if (Object.keys(fields).length > 0 || parcelsChanged) {
          updated += 1;
        } else {
          unchanged += 1;
        }
      } catch (err) {
        errors.push(
          `Bill ${g.awb}: lỗi khi cập nhật — ${err instanceof Error ? err.message : String(err)}`
        );
      }
      continue;
    }

    // Bill mới hoàn toàn.
    try {
      const falcoCode = nextFalcoCode(existingFalcoCodes);
      existingFalcoCodes.add(falcoCode);
      existingAwb.add(awbUpper);

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
      insertedCodes.push(falcoCode);

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
    } catch (err) {
      errors.push(
        `Bill ${g.awb}: lỗi khi thêm mới — ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (sheetMirrorRows.length > 0) {
    try {
      await appendOrders(sheetMirrorRows);
    } catch (err) {
      errors.push(
        `Đã ghi MySQL thành công nhưng mirror sang Google Sheet thất bại: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    totalBills: groups.length,
    inserted,
    updated,
    unchanged,
    insertedCodes,
    errors,
  };
}
