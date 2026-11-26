import type { KangoInvoiceItem, KangoPackage } from "./db";

export const ALLOWED_PACKAGE_TYPES = new Set([0, 1, 2]); // 0 Carton, 1 Pallet, 2 Túi (Phong bì)
export const ALLOWED_INVOICE_UNITS = new Set([0, 1, 2, 3]); // 0 Pcs, 1 Bag, 2 Box, 3 Jar
export const ALLOWED_EXPORT_AS = new Set([0, 1]); // 0 Gift, 1 Sample

export const ALLOWED_KANGO_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_KANGO_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB mỗi ảnh
export const MAX_KANGO_BILL_IMAGES = 6;

export const MAX_CUSTOMER_NOTE_LENGTH = 500;

/** Kiểm tra chuỗi ID là số nguyên dương (chặn chữ, số âm, 0, số thập phân, ký hiệu khoa học). */
export function parsePositiveId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

function toStrictFiniteNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || typeof raw === "boolean") return null;
  if (typeof raw === "string" && !raw.trim()) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

/** Giá trị kiện hàng (USD): bắt buộc phải là số dương > 0. */
export function validateShipmentValue(raw: unknown): number | null {
  const num = toStrictFiniteNumber(raw);
  if (num === null || num <= 0) return null;
  return num;
}

/** Lý do gửi hàng (shipment_export_as): chỉ chấp nhận 0 (Gift) hoặc 1 (Sample). */
export function validateShipmentExportAs(raw: unknown): number | null {
  const num = toStrictFiniteNumber(raw);
  if (num === null || !Number.isInteger(num) || !ALLOWED_EXPORT_AS.has(num)) return null;
  return num;
}

export function validateKangoPackages(packages: unknown): KangoPackage[] | null {
  if (!Array.isArray(packages) || packages.length === 0) return null;
  const parsed: KangoPackage[] = [];
  for (const item of packages) {
    if (!item || typeof item !== "object") return null;
    const p = item as Record<string, unknown>;
    const qty = toStrictFiniteNumber(p.packageQuantity);
    const type = toStrictFiniteNumber(p.packageType);
    const length = toStrictFiniteNumber(p.packageLength);
    const width = toStrictFiniteNumber(p.packageWidth);
    const height = toStrictFiniteNumber(p.packageHeight);
    const weight = toStrictFiniteNumber(p.packageWeight);

    if (
      qty === null ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      type === null ||
      !Number.isInteger(type) ||
      !ALLOWED_PACKAGE_TYPES.has(type) ||
      length === null ||
      length <= 0 ||
      width === null ||
      width <= 0 ||
      height === null ||
      height <= 0 ||
      weight === null ||
      weight <= 0
    ) {
      return null;
    }
    parsed.push({
      packageQuantity: qty,
      packageType: type,
      packageLength: length,
      packageWidth: width,
      packageHeight: height,
      packageWeight: weight,
    });
  }
  return parsed;
}

export function validateKangoInvoices(invoices: unknown): KangoInvoiceItem[] | null {
  if (invoices === undefined || invoices === null) return [];
  if (!Array.isArray(invoices)) return null;
  const parsed: KangoInvoiceItem[] = [];
  for (const item of invoices) {
    if (!item || typeof item !== "object") return null;
    const i = item as Record<string, unknown>;
    if (typeof i.invoiceGoodsDetails !== "string" || !i.invoiceGoodsDetails.trim()) {
      return null;
    }
    const qty = toStrictFiniteNumber(i.invoiceQuantity);
    const unit = toStrictFiniteNumber(i.invoiceUnit);
    const price = toStrictFiniteNumber(i.invoicePrice);
    const totalPrice = toStrictFiniteNumber(i.invoiceTotalPrice);

    if (
      qty === null ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      unit === null ||
      !Number.isInteger(unit) ||
      !ALLOWED_INVOICE_UNITS.has(unit) ||
      price === null ||
      price < 0 ||
      totalPrice === null ||
      totalPrice < 0
    ) {
      return null;
    }
    parsed.push({
      invoiceGoodsDetails: i.invoiceGoodsDetails.trim(),
      invoiceQuantity: qty,
      invoiceUnit: unit,
      invoicePrice: price,
      invoiceTotalPrice: totalPrice,
    });
  }
  return parsed;
}

export function validateCustomerNote(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") {
    return { ok: false, error: "Ghi chú cho khách không hợp lệ" };
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_CUSTOMER_NOTE_LENGTH) {
    return {
      ok: false,
      error: `Ghi chú cho khách không được vượt quá ${MAX_CUSTOMER_NOTE_LENGTH} ký tự`,
    };
  }
  return { ok: true, value: trimmed || null };
}

/** Parse JSON mảng an toàn, trả về [] nếu dữ liệu rỗng hoặc hỏng định dạng. */
export function parseKangoPackagesJson(raw: string | null | undefined): KangoPackage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KangoPackage[]) : [];
  } catch {
    return [];
  }
}

export function parseKangoInvoicesJson(raw: string | null | undefined): KangoInvoiceItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KangoInvoiceItem[]) : [];
  } catch {
    return [];
  }
}

export function parseKangoHawbsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}
