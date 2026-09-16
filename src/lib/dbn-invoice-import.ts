/**
 * Đọc file "Debit note" (DBN) Kango gửi cho Falco — mỗi file là 1 hoá đơn
 * cước, liệt kê nhiều AWB kèm số tiền phải trả (TOTAL PRICE) — và ghi số đó
 * vào cột CHI (`orders.cost`) của đúng đơn tương ứng (khớp theo AWB = "BILL
 * NO" trong file).
 *
 * File mẫu thực tế (KOKO/Kango xuất ra) có phần đầu là thông tin công ty +
 * "Invoice Number"/"Invoice Date" nằm lẫn trong 1 ô text nhiều dòng, rồi tới
 * bảng dữ liệu với dòng tiêu đề chứa "BILL NO"/"TOTAL PRICE", kết thúc bằng
 * 1 dòng "TOTAL" chứa tổng cộng — dùng dòng này để đối chiếu an toàn (tổng
 * các dòng phải khớp tổng file, sai thì huỷ xử lý toàn bộ, không ghi gì).
 *
 * Dò cột theo TÊN tiêu đề (không hard-code vị trí cột như kango-import.ts)
 * vì đây là file Kango xuất thủ công cho từng hoá đơn, thứ tự cột có thể xê
 * dịch giữa các lần xuất khác ngày.
 */
import * as XLSX from "xlsx";
import {
  findOrderByAwb,
  findOrderById,
  listOrderParcels,
  insertOrderEditHistory,
  updateOrder,
  type OrderRecord,
} from "./db";
import { upsertAccountingRow } from "./sheets";
import { statusLabel } from "./payment-status";

function cellToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

/**
 * Cột tiền trong file DBN có lúc là số thuần (8505000), có lúc là chuỗi có
 * dấu phẩy ngăn cách hàng nghìn ("9,639,000") — đã gặp thực tế cả 2 dạng
 * giữa các lần Kango xuất file khác nhau. Bỏ dấu phẩy trước khi parse để
 * không báo nhầm "không phải số hợp lệ" và huỷ xử lý oan cả file.
 */
function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = cellToString(value).replace(/,/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

type HeaderMap = { rowIndex: number; colOf: Record<string, number> };

function findHeaderRow(rows: unknown[][]): HeaderMap | null {
  const scanLimit = Math.min(rows.length, 60);
  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    const colOf: Record<string, number> = {};
    row.forEach((cell, idx) => {
      const s = cellToString(cell).toUpperCase();
      if (s) colOf[s] = idx;
    });
    if (colOf["BILL NO"] !== undefined && colOf["TOTAL PRICE"] !== undefined) {
      return { rowIndex: i, colOf };
    }
  }
  return null;
}

function findInvoiceMeta(
  rows: unknown[][]
): { invoiceNumber: string; invoiceDate: string | null } | null {
  const scanLimit = Math.min(rows.length, 15);
  for (let i = 0; i < scanLimit; i++) {
    for (const cell of rows[i]) {
      const text = cellToString(cell);
      if (!/invoice number/i.test(text)) continue;
      const numMatch = text.match(/Invoice\s*Number\s*[:\-]?\s*(\S+)/i);
      if (!numMatch) continue;
      const dateMatch = text.match(
        /Invoice\s*Date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/i
      );
      return {
        invoiceNumber: numMatch[1].trim(),
        invoiceDate: dateMatch ? dateMatch[1].replace(" ", "T") : null,
      };
    }
  }
  return null;
}

export type DbnInvoiceLine = { awb: string; amount: number; note: string };

export type ParsedDbnInvoice =
  | {
      ok: true;
      invoiceNumber: string;
      invoiceDate: string | null;
      lines: DbnInvoiceLine[];
      totalFromFile: number | null;
    }
  | { ok: false; error: string };

export function parseDbnInvoiceWorkbook(buffer: Buffer): ParsedDbnInvoice {
  let rows: unknown[][];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: "",
    }) as unknown[][];
  } catch {
    return {
      ok: false,
      error: "Không đọc được file — hãy chắc chắn đây là file Excel (.xlsx) DBN Kango xuất ra.",
    };
  }

  const meta = findInvoiceMeta(rows);
  if (!meta) {
    return {
      ok: false,
      error: 'Không tìm thấy "Invoice Number" trong file — có thể không phải file DBN Kango.',
    };
  }

  const header = findHeaderRow(rows);
  if (!header) {
    return {
      ok: false,
      error:
        'Không tìm thấy dòng tiêu đề (cột "BILL NO"/"TOTAL PRICE") — file có thể sai định dạng hoặc Kango đã đổi mẫu, đã HUỶ xử lý.',
    };
  }

  const colBillNo = header.colOf["BILL NO"];
  const colTotalPrice = header.colOf["TOTAL PRICE"];
  const colDesc = header.colOf["DESCRIPTION OF GOODS"];

  const lines: DbnInvoiceLine[] = [];
  let totalFromFile: number | null = null;

  for (let i = header.rowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    // Dòng tổng luôn bắt đầu bằng "TOTAL" ở cột đầu tiên trong mẫu thực tế —
    // gặp dòng này thì dừng hẳn, bỏ qua phần ghi chú/điều khoản phía sau.
    if (cellToString(row[0]).toUpperCase() === "TOTAL") {
      totalFromFile = parseAmount(row[colTotalPrice]);
      break;
    }

    const awb = cellToString(row[colBillNo]);
    if (!awb) continue;

    const amount = parseAmount(row[colTotalPrice]);
    if (amount === null) {
      return {
        ok: false,
        error: `Dòng AWB ${awb}: cột TOTAL PRICE không phải số hợp lệ — đã HUỶ xử lý toàn bộ file.`,
      };
    }

    lines.push({
      awb,
      amount,
      note: colDesc !== undefined ? cellToString(row[colDesc]) : "",
    });
  }

  if (lines.length === 0) {
    return { ok: false, error: "Không tìm thấy dòng dữ liệu nào (AWB) trong file." };
  }

  if (totalFromFile !== null) {
    const sumLines = lines.reduce((s, l) => s + l.amount, 0);
    if (sumLines !== totalFromFile) {
      return {
        ok: false,
        error: `Tổng các dòng (${sumLines.toLocaleString("vi-VN")}đ) không khớp dòng TOTAL trong file (${totalFromFile.toLocaleString("vi-VN")}đ) — đã HUỶ xử lý, kiểm tra lại file gốc.`,
      };
    }
  }

  return { ok: true, invoiceNumber: meta.invoiceNumber, invoiceDate: meta.invoiceDate, lines, totalFromFile };
}

export type DbnLineResult = {
  awb: string;
  amount: number;
  note: string;
  matched: boolean;
  falcoCode?: string;
  orderId?: number;
  status?: "new" | "update" | "unchanged" | "needs_review";
  previousCost?: number | null;
  previousSourceInvoice?: string | null;
  reason?: string;
  applied?: boolean;
};

export type DbnInvoiceApplyResult = {
  fileName: string;
  ok: boolean;
  error?: string;
  invoiceNumber?: string;
  invoiceDate?: string | null;
  totalFromFile?: number | null;
  lines?: DbnLineResult[];
};

function formatDateVN(value: string | Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

async function syncSheet(order: OrderRecord) {
  try {
    await upsertAccountingRow({
      falcoCode: order.falco_code,
      awb: order.awb,
      recipientName: order.recipient_name ?? "",
      destination: order.destination ?? "",
      receivedDate: formatDateVN(order.received_date),
      paymentStatusLabel: statusLabel(order.payment_status),
      amount: Number(order.amount ?? 0),
      cost: Number(order.cost ?? 0),
    });
  } catch {
    // Sheet chỉ là bản mirror để xem — không chặn ghi CHI vì lỗi đồng bộ Sheet.
  }
}

/**
 * Xử lý 1 file DBN: khớp từng dòng với đơn theo AWB rồi ghi CHI.
 *
 * `dryRun: true` chỉ tính toán, không ghi gì (dùng cho bước xem trước trên
 * UI). Dòng nào CHI hiện tại không rõ nguồn gốc (không phải chính hoá đơn
 * này) và giá trị khác với file mới — được đánh dấu "needs_review", mặc
 * định KHÔNG ghi đè trừ khi AWB đó có trong `force`.
 */
export async function applyDbnInvoice(
  buffer: Buffer,
  fileName: string,
  opts: { dryRun: boolean; force: Set<string>; uploadedBy: string }
): Promise<DbnInvoiceApplyResult> {
  const parsed = parseDbnInvoiceWorkbook(buffer);
  if (!parsed.ok) return { fileName, ok: false, error: parsed.error };

  const changedBy = `${opts.uploadedBy} · Upload DBN #${parsed.invoiceNumber}`;
  const lineResults: DbnLineResult[] = [];

  for (const line of parsed.lines) {
    const order = await findOrderByAwb(line.awb);
    if (!order) {
      lineResults.push({
        ...line,
        matched: false,
        reason: "Không tìm thấy AWB này trong hệ thống Falco",
      });
      continue;
    }

    const previousCost = order.cost === null ? null : Number(order.cost);
    const previousSourceInvoice = order.chi_source_invoice;

    let status: NonNullable<DbnLineResult["status"]>;
    let reason: string | undefined;
    if (previousSourceInvoice === parsed.invoiceNumber) {
      status = "update";
    } else if (previousSourceInvoice === null && previousCost === null) {
      status = "new";
    } else if (previousSourceInvoice === null && previousCost === line.amount) {
      status = "unchanged";
    } else if (previousSourceInvoice === null) {
      status = "needs_review";
      reason = `Đơn đã có CHI = ${previousCost?.toLocaleString("vi-VN")}đ (không rõ nguồn, có thể nhập tay) — khác với ${line.amount.toLocaleString("vi-VN")}đ trong file này`;
    } else {
      status = "needs_review";
      reason = `Đơn đã có CHI từ hoá đơn khác (#${previousSourceInvoice}) — có thể trùng AWB giữa 2 hoá đơn`;
    }

    const willApply = status !== "needs_review" || opts.force.has(line.awb);
    let applied = false;

    if (!opts.dryRun && willApply) {
      const parcels = await listOrderParcels(order.id);
      await insertOrderEditHistory({
        orderId: order.id,
        action: "update",
        changedBy,
        beforeData: { order, trackingCodes: parcels.map((p) => p.tracking_code) },
      });
      await updateOrder(order.id, { cost: line.amount, chiSourceInvoice: parsed.invoiceNumber });
      const fresh = await findOrderById(order.id);
      if (fresh) await syncSheet(fresh);
      applied = true;
    }

    lineResults.push({
      ...line,
      matched: true,
      falcoCode: order.falco_code,
      orderId: order.id,
      status,
      previousCost,
      previousSourceInvoice,
      reason,
      applied,
    });
  }

  return {
    fileName,
    ok: true,
    invoiceNumber: parsed.invoiceNumber,
    invoiceDate: parsed.invoiceDate,
    totalFromFile: parsed.totalFromFile,
    lines: lineResults,
  };
}
