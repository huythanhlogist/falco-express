import type { KangoInvoiceItem, KangoPackage } from "./db";

export function validateKangoPackages(packages: unknown): KangoPackage[] | null {
  if (!Array.isArray(packages) || packages.length === 0) return null;
  const parsed: KangoPackage[] = [];
  for (const p of packages) {
    if (
      !p ||
      !Number.isFinite(Number(p.packageQuantity)) ||
      !Number.isFinite(Number(p.packageType)) ||
      !Number.isFinite(Number(p.packageLength)) ||
      !Number.isFinite(Number(p.packageWidth)) ||
      !Number.isFinite(Number(p.packageHeight)) ||
      !Number.isFinite(Number(p.packageWeight))
    ) {
      return null;
    }
    parsed.push({
      packageQuantity: Number(p.packageQuantity),
      packageType: Number(p.packageType),
      packageLength: Number(p.packageLength),
      packageWidth: Number(p.packageWidth),
      packageHeight: Number(p.packageHeight),
      packageWeight: Number(p.packageWeight),
    });
  }
  return parsed;
}

export function validateKangoInvoices(invoices: unknown): KangoInvoiceItem[] | null {
  if (invoices === undefined || invoices === null) return [];
  if (!Array.isArray(invoices)) return null;
  const parsed: KangoInvoiceItem[] = [];
  for (const i of invoices) {
    if (
      !i ||
      typeof i.invoiceGoodsDetails !== "string" ||
      !i.invoiceGoodsDetails.trim() ||
      !Number.isFinite(Number(i.invoiceQuantity)) ||
      !Number.isFinite(Number(i.invoiceUnit)) ||
      !Number.isFinite(Number(i.invoicePrice)) ||
      !Number.isFinite(Number(i.invoiceTotalPrice))
    ) {
      return null;
    }
    parsed.push({
      invoiceGoodsDetails: i.invoiceGoodsDetails.trim(),
      invoiceQuantity: Number(i.invoiceQuantity),
      invoiceUnit: Number(i.invoiceUnit),
      invoicePrice: Number(i.invoicePrice),
      invoiceTotalPrice: Number(i.invoiceTotalPrice),
    });
  }
  return parsed;
}
