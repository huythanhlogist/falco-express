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
 * trước — với AWB đã có: cập nhật các trường khi file mới có giá trị KHÁC
 * dữ liệu hiện tại (vừa điền chỗ trống — vd mã tracking chưa có ở lần
 * trước — vừa cập nhật khi thông tin thực sự thay đổi, vd đổi tên/SĐT). Ô
 * nào file mới để trống thì giữ nguyên dữ liệu cũ, không xoá mất.
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

// Từ khoá kỳ vọng có trong DÒNG TIÊU ĐỀ (row 0) ở đúng vị trí cột tương
// ứng — dùng để CHẶN việc xử lý nếu file upload lên sai định dạng (đã có
// sự cố thật: 1 file Excel khác cấu trúc bị đọc nhầm cột, ghi đè dữ liệu
// sai vào các đơn có sẵn mà không ai biết). Không khớp đủ từ khoá bắt buộc
// → HUỶ xử lý toàn bộ file, không ghi bất kỳ thay đổi nào vào DB.
const REQUIRED_HEADER_KEYWORDS: { col: keyof typeof COL; keyword: string }[] = [
  { col: "AWB", keyword: "AWB" },
  { col: "TRACKING_NUMBER", keyword: "TRACKING" },
  { col: "SERVICE", keyword: "SERVICE" },
  { col: "DATE", keyword: "DATE" },
  { col: "CONTACT", keyword: "CONTACT" },
  { col: "CITY", keyword: "CITY" },
  { col: "COUNTRY", keyword: "COUNTRY" },
  { col: "TELEPHONE", keyword: "PHONE" },
];

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

/**
 * Kiểm tra dòng tiêu đề có đúng cấu trúc cột Kango kỳ vọng không — trả về
 * danh sách lỗi cụ thể (rỗng nếu hợp lệ). Chỉ cần MỘT cột sai vị trí là đủ
 * để toàn bộ dữ liệu bên dưới bị đọc nhầm, nên bất kỳ từ khoá nào không
 * khớp cũng coi là file sai định dạng.
 */
function validateHeaderRow(header: unknown[]): string[] {
  const problems: string[] = [];
  for (const { col, keyword } of REQUIRED_HEADER_KEYWORDS) {
    const idx = COL[col];
    const cell = cellToString(header[idx]).toUpperCase();
    if (!cell.includes(keyword)) {
      problems.push(
        `Cột vị trí ${idx + 1} kỳ vọng là "${col}" (chứa "${keyword}") nhưng tiêu đề thực tế là "${cellToString(header[idx]) || "(trống)"}"`
      );
    }
  }
  return problems;
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

/**
 * mysql2 trả cột DATE về dưới dạng `Date` object (giờ local), không phải
 * chuỗi — không được lấy ISO string rồi cắt chuỗi (`toISOString().slice`),
 * vì `toISOString()` quy về UTC và có thể lùi lại 1 ngày ở múi giờ UTC+7
 * (đã từng gây lỗi thật, xem OrderRowActions.toDateInputValue). Dùng đúng
 * các thành phần ngày/tháng/năm local để so sánh cho khớp giá trị đã lưu.
 */
function toIsoDate(value: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
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

// Trạng thái đơn TRƯỚC khi bị lượt upload này sửa — đủ dữ liệu để hoàn tác
// đúng nguyên trạng (không chỉ các trường bị đổi, để đơn giản và chắc chắn).
export type UpdatedOrderSnapshot = {
  orderId: number;
  recipientName: string | null;
  recipientPhone: string | null;
  service: string | null;
  destination: string | null;
  receivedDate: string | null; // ISO yyyy-mm-dd
  trackingCodes: string[];
};

export type UploadSnapshot = {
  insertedOrders: { orderId: number; falcoCode: string }[];
  updatedOrders: UpdatedOrderSnapshot[];
};

export type KangoImportResult = {
  totalBills: number;
  inserted: number;
  updated: number;
  unchanged: number;
  insertedCodes: string[];
  errors: string[];
  snapshot: UploadSnapshot;
};

export async function processKangoWorkbook(
  buffer: Buffer
): Promise<KangoImportResult> {
  const emptySnapshot: UploadSnapshot = { insertedOrders: [], updatedOrders: [] };
  const empty: KangoImportResult = {
    totalBills: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    insertedCodes: [],
    errors: [],
    snapshot: emptySnapshot,
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

  const headerProblems = validateHeaderRow(rows[0]);
  if (headerProblems.length > 0) {
    return {
      ...empty,
      errors: [
        "File SAI định dạng Kango — đã HUỶ xử lý, KHÔNG có dữ liệu nào bị thay đổi:",
        ...headerProblems,
      ],
    };
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
  const snapshot: UploadSnapshot = { insertedOrders: [], updatedOrders: [] };
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

        // Cập nhật khi file mới có giá trị KHÁC với dữ liệu hiện tại — bao
        // gồm cả điền vào chỗ đang trống LẪN thông tin đã đổi (vd khách đổi
        // SĐT). Nếu file mới để trống ô đó thì giữ nguyên dữ liệu cũ, không
        // xoá mất — vì 1 lần xuất file có thể thiếu thông tin.
        const fields: OrderEditableFields = {};
        if (g.contact && g.contact !== (existing.recipient_name ?? "")) {
          fields.recipientName = g.contact;
        }
        if (g.telephone && g.telephone !== (existing.recipient_phone ?? "")) {
          fields.recipientPhone = g.telephone;
        }
        if (g.service && g.service !== (existing.service ?? "")) {
          fields.service = g.service;
        }
        if (destination && destination !== (existing.destination ?? "")) {
          fields.destination = destination;
        }
        if (g.dateIso && g.dateIso !== toIsoDate(existing.received_date)) {
          fields.receivedDate = g.dateIso;
        }

        // Luôn lấy danh sách kiện HIỆN TẠI trước khi đổi gì — cần để hoàn
        // tác đúng nguyên trạng nếu lượt upload này hoá ra bị sai.
        const existingParcels = await listOrderParcels(existing.id);

        let parcelsChanged = false;
        if (g.trackingNumbers.length > 0) {
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
          snapshot.updatedOrders.push({
            orderId: existing.id,
            recipientName: existing.recipient_name,
            recipientPhone: existing.recipient_phone,
            service: existing.service,
            destination: existing.destination,
            receivedDate: toIsoDate(existing.received_date),
            trackingCodes: existingParcels.map((p) => p.tracking_code),
          });
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
      snapshot.insertedOrders.push({ orderId, falcoCode });

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
    snapshot,
  };
}
