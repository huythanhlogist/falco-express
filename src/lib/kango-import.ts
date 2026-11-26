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
 * dòng AWB gần nhất phía trên, đồng thời gộp cả các dòng trùng AWB không
 * liền kề trong cùng file.
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
  findOrdersByAwbs,
  insertOrderWithGeneratedFalcoCode,
  listOrderParcels,
  replaceOrderParcels,
  updateOrder,
  type OrderEditableFields,
  type OrderRecord,
} from "./db";
import { toIsoDateLocal, vnDateString } from "./vn-date";

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
  POSTAL_CODE: 22,
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
  postcode: string;
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

function buildCalendarDate(year: number, month: number, day: number): { iso: string; vn: string } | null {
  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    iso: `${year}-${pad(month)}-${pad(day)}`,
    vn: `${pad(day)}/${pad(month)}/${year}`,
  };
}

/**
 * Chuyển ô ngày trong Excel (hỗ trợ cả chuỗi dd-mm-yyyy, dd/mm/yyyy,
 * yyyy-mm-dd, Date object lẫn Excel Date serial number như 46123) sang
 * định dạng ISO (MySQL DATE) và DD/MM/YYYY (Google Sheet).
 */
function parseExcelDate(raw: unknown): { iso: string | null; vn: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { iso: null, vn: "" };
  }

  // Excel serial date (số ngày kể từ 1899-12-30 UTC với serial >= 61, tránh bug năm nhuận 1900 của Excel).
  const trySerial = (serial: number): { iso: string; vn: string } | null => {
    if (!Number.isFinite(serial) || serial < 20000 || serial > 100000) return null;
    const utcMs = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
    const d = new Date(utcMs);
    return buildCalendarDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  };

  if (typeof raw === "number") {
    const parsed = trySerial(raw);
    if (parsed) return parsed;
    return { iso: null, vn: String(raw) };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const iso = toIsoDateLocal(raw);
    if (iso) {
      const [y, m, d] = iso.split("-");
      return { iso, vn: `${d}/${m}/${y}` };
    }
    return { iso: null, vn: "" };
  }

  const str = String(raw).trim();
  if (!str) return { iso: null, vn: "" };

  // dd-mm-yyyy hoặc dd/mm/yyyy (có thể kèm phần giờ phía sau)
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s.*)?$/);
  if (dmy) {
    const parsed = buildCalendarDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
    if (parsed) return parsed;
  }

  // yyyy-mm-dd hoặc yyyy/mm/dd
  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[\sT].*)?$/);
  if (ymd) {
    const parsed = buildCalendarDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
    if (parsed) return parsed;
  }

  // Chuỗi số serial thuần (vd "46123" hoặc "46123.5")
  if (/^\d{5}(?:\.\d+)?$/.test(str)) {
    const parsed = trySerial(Number(str));
    if (parsed) return parsed;
  }

  return { iso: null, vn: str };
}

function appendUniqueTracking(list: string[], code: string): void {
  if (code && !list.includes(code)) {
    list.push(code);
  }
}

function groupRowsByAwb(rows: unknown[][], postalIdxOk: boolean): ShipmentGroup[] {
  const groups: ShipmentGroup[] = [];
  const byAwb = new Map<string, ShipmentGroup>();
  let current: ShipmentGroup | null = null;

  for (const row of rows) {
    const awb = cellToString(row[COL.AWB]);
    const tracking = cellToString(row[COL.TRACKING_NUMBER]);

    if (awb) {
      const awbKey = awb.toUpperCase();
      const parsedDate = parseExcelDate(row[COL.DATE]);
      const service = cellToString(row[COL.SERVICE]);
      const contact = cellToString(row[COL.CONTACT]);
      const telephone = cellToString(row[COL.TELEPHONE]);
      const postcode = postalIdxOk ? cellToString(row[COL.POSTAL_CODE]) : "";
      const city = cellToString(row[COL.CITY]);
      const country = cellToString(row[COL.COUNTRY]);

      const existing = byAwb.get(awbKey);
      if (existing) {
        // Trùng AWB không liền kề trong cùng file: gộp vào cùng 1 bill thay vì xử lý 2 lần.
        if (!existing.service && service) existing.service = service;
        if (!existing.dateIso && parsedDate.iso) {
          existing.dateIso = parsedDate.iso;
          existing.date = parsedDate.vn;
        }
        if (!existing.contact && contact) existing.contact = contact;
        if (!existing.telephone && telephone) existing.telephone = telephone;
        if (!existing.postcode && postcode) existing.postcode = postcode;
        if (!existing.city && city) existing.city = city;
        if (!existing.country && country) existing.country = country;
        appendUniqueTracking(existing.trackingNumbers, tracking);
        current = existing;
      } else {
        current = {
          awb,
          service,
          date: parsedDate.vn,
          dateIso: parsedDate.iso,
          contact,
          telephone,
          postcode,
          city,
          country,
          trackingNumbers: tracking ? [tracking] : [],
        };
        byAwb.set(awbKey, current);
        groups.push(current);
      }
    } else if (current && tracking) {
      // Dòng kiện tiếp theo của cùng bill phía trên (không có AWB riêng).
      appendUniqueTracking(current.trackingNumbers, tracking);
    }
  }

  return groups;
}

/** Tiền tố mã Falco hôm nay theo giờ Việt Nam (FLyyMMdd). */
export function todayFalcoPrefix(): string {
  const ymd = vnDateString();
  return `FL${ymd.slice(2, 4)}${ymd.slice(5, 7)}${ymd.slice(8, 10)}`;
}

export function nextFalcoCode(existingCodes: Set<string>): string {
  const prefix = todayFalcoPrefix();

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
  recipientPostcode?: string | null;
  service: string | null;
  destination: string | null;
  receivedDate: string | null; // ISO yyyy-mm-dd
  trackingCodes: string[];
  parcels?: { hawb: string; trackingCode: string }[];
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
  invalidFormat?: boolean;
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
      invalidFormat: true,
      errors: [
        "Không đọc được file — hãy chắc chắn đây là file Excel (.xlsx) đúng định dạng Kango xuất ra.",
      ],
    };
  }

  if (rows.length < 2) {
    return { ...empty, invalidFormat: true, errors: ["File không có dữ liệu."] };
  }

  const headerProblems = validateHeaderRow(rows[0]);
  if (headerProblems.length > 0) {
    return {
      ...empty,
      invalidFormat: true,
      errors: [
        "File SAI định dạng Kango — đã HUỶ xử lý, KHÔNG có dữ liệu nào bị thay đổi:",
        ...headerProblems,
      ],
    };
  }

  // Cột mã bưu chính chỉ dùng khi tiêu đề đúng là POSTAL (tránh đọc nhầm cột nếu Kango đổi mẫu).
  const postalIdxOk = cellToString(rows[0][COL.POSTAL_CODE]).toUpperCase().includes("POSTAL");
  const groups = groupRowsByAwb(rows.slice(1), postalIdxOk);
  if (groups.length === 0) {
    return {
      ...empty,
      invalidFormat: true,
      errors: [
        "Không tìm thấy bill nào — kiểm tra lại đúng file Kango xuất ra (cột cố định theo mẫu), chưa bị đổi cấu trúc cột.",
      ],
    };
  }

  // Chỉ truy vấn các AWB có trong file thay vì nạp cả bảng orders vào RAM.
  const existingOrdersRaw = await findOrdersByAwbs(groups.map((g) => g.awb));
  const existingByAwb = new Map<string, OrderRecord>();
  for (const order of existingOrdersRaw.values()) {
    existingByAwb.set(order.awb.toUpperCase(), order);
  }

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
    const existing = existingByAwb.get(awbUpper);

    if (existing) {
      try {
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
        if (g.postcode && g.postcode !== (existing.recipient_postcode ?? "")) {
          fields.recipientPostcode = g.postcode;
        }
        if (g.service && g.service !== (existing.service ?? "")) {
          fields.service = g.service;
        }
        if (destination && destination !== (existing.destination ?? "")) {
          fields.destination = destination;
        }
        const existingDateIso = toIsoDateLocal(existing.received_date);
        if (g.dateIso && g.dateIso !== existingDateIso) {
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
            const merged = [
              ...existingParcels.map((p) => ({ hawb: p.hawb, trackingCode: p.tracking_code })),
              ...newCodes.map((code) => ({ hawb: "", trackingCode: code })),
            ];
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
            recipientPostcode: existing.recipient_postcode,
            service: existing.service,
            destination: existing.destination,
            receivedDate: existingDateIso,
            trackingCodes: existingParcels.map((p) => p.tracking_code),
            parcels: existingParcels.map((p) => ({ hawb: p.hawb, trackingCode: p.tracking_code })),
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

    // Bill mới hoàn toàn — sinh mã Falco theo giờ VN và chèn đơn + kiện trong cùng transaction có khoá.
    try {
      const { id: orderId, falcoCode } = await insertOrderWithGeneratedFalcoCode(
        {
          awb: g.awb,
          recipientName: g.contact,
          recipientPhone: g.telephone,
          recipientPostcode: g.postcode,
          service: g.service,
          destination,
          receivedDate: g.dateIso,
        },
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
