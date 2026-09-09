/**
 * Đọc file bảng giá gốc Kango (nhiều sheet cố định tên) và trích ra dữ liệu
 * cho 3 nhóm giá Falco đang dùng ở tab "Báo giá": Air đông lạnh EU (Đức),
 * Chuyên tuyến EU DHL Priority (14 zone), UK Priority + UK đông lạnh
 * (KSN-UKDLBH). Theo đúng tinh thần phòng thủ của `kango-import.ts`: chỉ
 * cần MỘT sheet thiếu hoặc sai cấu trúc kỳ vọng là HUỶ toàn bộ, không ghi
 * gì vào DB — vì các cột ở đây không có tiêu đề tự mô tả rõ ràng (nhiều ô
 * merge, nhãn viết tắt), đọc nhầm cột sẽ cho ra giá sai mà không ai biết.
 *
 * Chỉ trích GIÁ GỐC Kango — KHÔNG cộng phụ phí (markup) ở bước này. Markup
 * luôn tính ở client lúc hiển thị/xuất ảnh (xem PriceQuoteCard), để nhân
 * viên chỉnh được ngay khi báo giá cho từng khách mà không cần upload lại
 * file. Mỗi dòng giá (`ParsedLine`) chỉ mang theo MỨC MẶC ĐỊNH markup —
 * dòng hàng đông lạnh mặc định cao hơn dòng hàng thường (xem FROZEN_MARKUP/
 * STANDARD_MARKUP bên dưới).
 */
import * as XLSX from "xlsx";

export type ParsedPriceRow = {
  weightLabel: string;
  isPerKg: boolean;
  priceOriginal: number;
};

export type ParsedLine = {
  title: string;
  countries: string;
  minWeightKg: number | null;
  markupFlatVnd: number;
  markupPerKgVnd: number;
  rows: ParsedPriceRow[];
};

export type ParsedCategory = {
  slug: string;
  title: string;
  note: string | null;
  lines: ParsedLine[];
};

export type PriceQuoteParseResult = {
  categories: ParsedCategory[];
  warnings: string[];
  errors: string[];
};

const FROZEN_MARKUP = { flat: 1_000_000, perKg: 70_000 };
const STANDARD_MARKUP = { flat: 500_000, perKg: 40_000 };

function cellToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseVnd(value: unknown): number | null {
  const s = cellToString(value).replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function parseWeight(value: unknown): number | null {
  const s = cellToString(value);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatWeightLabel(kg: number): string {
  return kg % 1 === 0 ? String(kg) : kg.toFixed(1);
}

function getSheet(workbook: XLSX.WorkBook, name: string): unknown[][] | null {
  const sheet = workbook.Sheets[name];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
}

// ---------------------------------------------------------------------
// Sheet "AIR ĐÔNG LẠNH - CHÂU ÂU" — chỉ Zone 1 (Đức) có giá thật, các zone
// khác đang "TẠM NGƯNG". Cột A = cân nặng (5.0-20.5, bước 0.5, hàng 8-39
// theo Excel = index 7-38), cột B = giá Zone 1/Đức. Hàng ">21Kg+" nằm ngay
// sau đó (index 40).
// ---------------------------------------------------------------------
function parseEuFrozenSheet(rows: unknown[][]): { category: ParsedCategory | null; errors: string[] } {
  const errors: string[] = [];
  const sheetLabel = 'Sheet "AIR ĐÔNG LẠNH - CHÂU ÂU"';

  const countryHeader = cellToString(rows[3]?.[1]).toUpperCase();
  if (!countryHeader.includes("GERMANY")) {
    errors.push(`${sheetLabel}: cột B kỳ vọng là "GERMANY" nhưng thực tế là "${cellToString(rows[3]?.[1]) || "(trống)"}" — cấu trúc sheet đã đổi.`);
    return { category: null, errors };
  }

  const priceRows: ParsedPriceRow[] = [];
  for (let i = 7; i <= 38; i++) {
    const weight = parseWeight(rows[i]?.[0]);
    const price = parseVnd(rows[i]?.[1]);
    if (weight === null || price === null) {
      errors.push(`${sheetLabel}: dòng cân nặng ${cellToString(rows[i]?.[0]) || `#${i + 1}`} không đọc được giá hợp lệ.`);
      return { category: null, errors };
    }
    priceRows.push({ weightLabel: formatWeightLabel(weight), isPerKg: false, priceOriginal: price });
  }
  if (priceRows.length !== 32) {
    errors.push(`${sheetLabel}: kỳ vọng 32 mức cân (5.0-20.5kg) nhưng đọc được ${priceRows.length}.`);
    return { category: null, errors };
  }

  // Hàng ">21Kg+" nằm ngay dưới nhãn "Đơn giá Vnđ/ Kgs" — dò trong vài dòng
  // kế tiếp thay vì cố định index để đỡ vỡ nếu Kango chèn thêm 1 dòng trống.
  let perKgPrice: number | null = null;
  for (let i = 39; i <= 42; i++) {
    if (cellToString(rows[i]?.[0]).toUpperCase().includes("21")) {
      perKgPrice = parseVnd(rows[i]?.[1]);
      break;
    }
  }
  if (perKgPrice === null) {
    errors.push(`${sheetLabel}: không tìm thấy dòng đơn giá "21Kg+".`);
    return { category: null, errors };
  }
  priceRows.push({ weightLabel: "Từ 21kg trở lên", isPerKg: true, priceOriginal: perKgPrice });

  return {
    category: {
      slug: "eu-dong-lanh",
      title: "Air đông lạnh EU (Đức)",
      note: null,
      lines: [
        {
          title: "Đức",
          countries: "Germany",
          minWeightKg: 5,
          markupFlatVnd: FROZEN_MARKUP.flat,
          markupPerKgVnd: FROZEN_MARKUP.perKg,
          rows: priceRows,
        },
      ],
    },
    errors: [],
  };
}

// ---------------------------------------------------------------------
// Sheet "CHUYÊN TUYẾN AIR-EU-PRIORITY" — khối DHL Priority: cột B-O (index
// 1-14) = Zone 1-14, cân nặng cột A hàng index 5-45 (0.5-20.5kg, bước 0.5)
// rồi 4 hàng khoảng 21+ (index 47-50). Bảng map Zone→Quốc gia cho DHL nằm
// ở cột AC-AG (index 28-32: Item, Countries, Code, Zone, Phụ phí), hàng
// index 5-32. Bỏ qua khối UPS-Priority/Trucking cạnh bên (ngoài phạm vi).
// ---------------------------------------------------------------------
const DHL_ZONE_COUNT = 14;
const DHL_ZONE_COL_START = 1; // cột B
const DHL_MAP_COUNTRY_COL = 29;
const DHL_MAP_CODE_COL = 30;
const DHL_MAP_ZONE_COL = 31;

function parseEuDhlPrioritySheet(rows: unknown[][]): { category: ParsedCategory | null; errors: string[] } {
  const errors: string[] = [];
  const sheetLabel = 'Sheet "CHUYÊN TUYẾN AIR-EU-PRIORITY"';

  if (!cellToString(rows[2]?.[1]).toUpperCase().includes("ZONE")) {
    errors.push(`${sheetLabel}: dòng 3 cột B kỳ vọng chứa "ZONE" nhưng là "${cellToString(rows[2]?.[1]) || "(trống)"}".`);
    return { category: null, errors };
  }
  if (!cellToString(rows[3]?.[1]).toUpperCase().includes("DHL")) {
    errors.push(`${sheetLabel}: dòng 4 cột B kỳ vọng chứa "DHL" nhưng là "${cellToString(rows[3]?.[1]) || "(trống)"}" — có thể Kango đã đổi thứ tự cột.`);
    return { category: null, errors };
  }
  const mapHeaderRow = rows[3] as unknown[];
  if (
    cellToString(mapHeaderRow[DHL_MAP_COUNTRY_COL]).toUpperCase() !== "COUNTRIES" ||
    cellToString(mapHeaderRow[DHL_MAP_ZONE_COL]).toUpperCase() !== "ZONE"
  ) {
    errors.push(`${sheetLabel}: không tìm thấy đúng vị trí bảng map Zone→Quốc gia (cột ${DHL_MAP_COUNTRY_COL + 1}/${DHL_MAP_ZONE_COL + 1}).`);
    return { category: null, errors };
  }

  // Gom Zone -> danh sách quốc gia, theo thứ tự xuất hiện trong file.
  const zoneCountries = new Map<number, string[]>();
  for (let i = 5; i <= 32; i++) {
    const country = cellToString(rows[i]?.[DHL_MAP_COUNTRY_COL]);
    const zone = Number(cellToString(rows[i]?.[DHL_MAP_ZONE_COL]));
    if (!country || !Number.isFinite(zone)) continue;
    if (!zoneCountries.has(zone)) zoneCountries.set(zone, []);
    zoneCountries.get(zone)!.push(country);
  }
  for (let z = 1; z <= DHL_ZONE_COUNT; z++) {
    if (!zoneCountries.has(z) || zoneCountries.get(z)!.length === 0) {
      errors.push(`${sheetLabel}: không tìm thấy quốc gia nào cho Zone ${z} trong bảng map.`);
      return { category: null, errors };
    }
  }

  // Cân lẻ 0.5-20.5kg (41 hàng, index 5-45).
  const weightRows: { weightLabel: string; pricesByZone: number[] }[] = [];
  for (let i = 5; i <= 45; i++) {
    const weight = parseWeight(rows[i]?.[0]);
    if (weight === null) {
      errors.push(`${sheetLabel}: dòng cân nặng #${i + 1} không đọc được (kỳ vọng danh sách 0.5-20.5kg liên tục).`);
      return { category: null, errors };
    }
    const prices: number[] = [];
    for (let z = 0; z < DHL_ZONE_COUNT; z++) {
      const price = parseVnd(rows[i]?.[DHL_ZONE_COL_START + z]);
      if (price === null) {
        errors.push(`${sheetLabel}: cân ${weight}kg, Zone ${z + 1} không đọc được giá hợp lệ.`);
        return { category: null, errors };
      }
      prices.push(price);
    }
    weightRows.push({ weightLabel: formatWeightLabel(weight), pricesByZone: prices });
  }
  if (weightRows.length !== 41) {
    errors.push(`${sheetLabel}: kỳ vọng 41 mức cân (0.5-20.5kg) nhưng đọc được ${weightRows.length}.`);
    return { category: null, errors };
  }

  // 4 khoảng 21+ (index 47-50) — PHẢI giống hệt nhau ở mỗi zone, gộp lại
  // thành 1 dòng duy nhất. Lệch nhau thì huỷ toàn bộ, không tự chọn đại.
  const bandRows = [47, 48, 49, 50];
  const perKgByZone: number[] = [];
  for (let z = 0; z < DHL_ZONE_COUNT; z++) {
    const values = bandRows.map((i) => parseVnd(rows[i]?.[DHL_ZONE_COL_START + z]));
    if (values.some((v) => v === null)) {
      errors.push(`${sheetLabel}: Zone ${z + 1} thiếu giá ở 1 trong 4 khoảng cân "21kg trở lên".`);
      return { category: null, errors };
    }
    const distinct = new Set(values);
    if (distinct.size !== 1) {
      errors.push(
        `${sheetLabel}: Zone ${z + 1} có giá KHÁC NHAU giữa 4 khoảng cân 21+ (${values.join(", ")}) — huỷ import, cần kiểm tra lại file Kango.`
      );
      return { category: null, errors };
    }
    perKgByZone.push(values[0] as number);
  }

  const lines: ParsedLine[] = [];
  for (let z = 1; z <= DHL_ZONE_COUNT; z++) {
    const zoneIdx = z - 1;
    const priceRows: ParsedPriceRow[] = weightRows.map((w) => ({
      weightLabel: w.weightLabel,
      isPerKg: false,
      priceOriginal: w.pricesByZone[zoneIdx],
    }));
    priceRows.push({ weightLabel: "Từ 21kg trở lên", isPerKg: true, priceOriginal: perKgByZone[zoneIdx] });
    lines.push({
      title: zoneCountries.get(z)!.join(", "),
      countries: zoneCountries.get(z)!.join(", "),
      minWeightKg: null,
      markupFlatVnd: STANDARD_MARKUP.flat,
      markupPerKgVnd: STANDARD_MARKUP.perKg,
      rows: priceRows,
    });
  }

  return {
    category: {
      slug: "eu-chuyen-tuyen-dhl",
      title: "Chuyên tuyến EU - DHL Priority",
      note: null,
      lines,
    },
    errors: [],
  };
}

// ---------------------------------------------------------------------
// Sheet "AIR-NZ-UK KHÔ-LẠNH" — cột F (index 5) = KSN-UKDLBH (đông lạnh có
// bảo hiểm cước), cột H (index 7) = AIR-UK-PRIORITY. Cân nặng cột A, hàng
// index 14-54 (0.5-20.5kg), rồi 4 hàng khoảng 21+ (index 56-59).
// ---------------------------------------------------------------------
const UK_DLBH_COL = 5;
const UK_PRIORITY_COL = 7;

function parseUkSheet(rows: unknown[][]): { category: ParsedCategory | null; errors: string[] } {
  const errors: string[] = [];
  const sheetLabel = 'Sheet "AIR-NZ-UK KHÔ-LẠNH"';

  const dlbhHeader = cellToString(rows[13]?.[UK_DLBH_COL]).toUpperCase();
  const priorityHeader = cellToString(rows[13]?.[UK_PRIORITY_COL]).toUpperCase();
  if (!dlbhHeader.includes("UKDLBH")) {
    errors.push(`${sheetLabel}: cột ${UK_DLBH_COL + 1} kỳ vọng "KSN-UKDLBH" nhưng là "${cellToString(rows[13]?.[UK_DLBH_COL]) || "(trống)"}".`);
    return { category: null, errors };
  }
  if (!priorityHeader.includes("AIR-UK-PRIORITY")) {
    errors.push(`${sheetLabel}: cột ${UK_PRIORITY_COL + 1} kỳ vọng "AIR-UK-PRIORITY" nhưng là "${cellToString(rows[13]?.[UK_PRIORITY_COL]) || "(trống)"}".`);
    return { category: null, errors };
  }

  const weightRows: { weightLabel: string; dlbh: number; priority: number }[] = [];
  for (let i = 14; i <= 54; i++) {
    const weight = parseWeight(rows[i]?.[0]);
    const dlbh = parseVnd(rows[i]?.[UK_DLBH_COL]);
    const priority = parseVnd(rows[i]?.[UK_PRIORITY_COL]);
    if (weight === null || dlbh === null || priority === null) {
      errors.push(`${sheetLabel}: dòng cân nặng ${cellToString(rows[i]?.[0]) || `#${i + 1}`} thiếu giá UKDLBH hoặc UK Priority.`);
      return { category: null, errors };
    }
    weightRows.push({ weightLabel: formatWeightLabel(weight), dlbh, priority });
  }
  if (weightRows.length !== 41) {
    errors.push(`${sheetLabel}: kỳ vọng 41 mức cân (0.5-20.5kg) nhưng đọc được ${weightRows.length}.`);
    return { category: null, errors };
  }

  const bandRows = [56, 57, 58, 59];
  for (const col of [UK_DLBH_COL, UK_PRIORITY_COL]) {
    const values = bandRows.map((i) => parseVnd(rows[i]?.[col]));
    if (values.some((v) => v === null)) {
      errors.push(`${sheetLabel}: thiếu giá ở 1 trong 4 khoảng cân "21kg trở lên" (cột ${col + 1}).`);
      return { category: null, errors };
    }
    if (new Set(values).size !== 1) {
      errors.push(`${sheetLabel}: giá KHÁC NHAU giữa 4 khoảng cân 21+ ở cột ${col + 1} (${values.join(", ")}) — huỷ import.`);
      return { category: null, errors };
    }
  }
  const dlbhPerKg = parseVnd(rows[56]?.[UK_DLBH_COL])!;
  const priorityPerKg = parseVnd(rows[56]?.[UK_PRIORITY_COL])!;

  const dlbhRows: ParsedPriceRow[] = weightRows.map((w) => ({ weightLabel: w.weightLabel, isPerKg: false, priceOriginal: w.dlbh }));
  dlbhRows.push({ weightLabel: "Từ 21kg trở lên", isPerKg: true, priceOriginal: dlbhPerKg });

  const priorityRows: ParsedPriceRow[] = weightRows.map((w) => ({ weightLabel: w.weightLabel, isPerKg: false, priceOriginal: w.priority }));
  priorityRows.push({ weightLabel: "Từ 21kg trở lên", isPerKg: true, priceOriginal: priorityPerKg });

  return {
    category: {
      slug: "uk-priority-dong-lanh",
      title: "UK Priority & Đông lạnh",
      note: null,
      lines: [
        {
          title: "UK Priority",
          countries: "United Kingdom",
          minWeightKg: null,
          markupFlatVnd: STANDARD_MARKUP.flat,
          markupPerKgVnd: STANDARD_MARKUP.perKg,
          rows: priorityRows,
        },
        {
          title: "UK Đông lạnh (có bảo hiểm cước)",
          countries: "United Kingdom",
          minWeightKg: null,
          markupFlatVnd: FROZEN_MARKUP.flat,
          markupPerKgVnd: FROZEN_MARKUP.perKg,
          rows: dlbhRows,
        },
      ],
    },
    errors: [],
  };
}

export function parseKangoPriceWorkbook(buffer: Buffer): PriceQuoteParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return {
      categories: [],
      warnings: [],
      errors: ["Không đọc được file — hãy chắc chắn đây là file Excel (.xlsx) đúng định dạng Kango xuất ra."],
    };
  }

  const sheetSpecs: { name: string; parser: (rows: unknown[][]) => { category: ParsedCategory | null; errors: string[] } }[] = [
    { name: "AIR ĐÔNG LẠNH - CHÂU ÂU", parser: parseEuFrozenSheet },
    { name: "CHUYÊN TUYẾN AIR-EU-PRIORITY", parser: parseEuDhlPrioritySheet },
    { name: "AIR-NZ-UK KHÔ-LẠNH", parser: parseUkSheet },
  ];

  const errors: string[] = [];
  const categories: ParsedCategory[] = [];

  for (const spec of sheetSpecs) {
    const rows = getSheet(workbook, spec.name);
    if (!rows) {
      errors.push(`Không tìm thấy sheet "${spec.name}" trong file — kiểm tra lại đúng file Kango xuất ra.`);
      continue;
    }
    const { category, errors: sheetErrors } = spec.parser(rows);
    errors.push(...sheetErrors);
    if (category) categories.push(category);
  }

  // Toàn-bộ-hoặc-không-gì: chỉ 1 sheet lỗi là huỷ import cả 3 nhóm, để
  // tránh cập nhật lệch (vd chỉ EU đổi giá còn UK vẫn dữ liệu cũ) mà không
  // ai để ý.
  if (errors.length > 0) {
    return { categories: [], warnings: [], errors };
  }

  return { categories, warnings: [], errors: [] };
}
