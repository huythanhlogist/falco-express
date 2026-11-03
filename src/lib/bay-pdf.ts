import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import type { BayShipment, BayTracking } from "./bay-api";
import { BAY_EVENT_VI, toVnTime } from "./bay-tracking";
import { bayImageUuid, fetchBayImage, readSavedImage } from "./bay-images";
import { BAY_STATUS_LABELS } from "./bay-labels";

// PDF hành trình 1 vận đơn: logo Falco + thông tin + các mốc theo thời gian kèm ảnh hàng.
// Nhẹ: ảnh thu về ≤ 560px, JPEG chất lượng 65, nhúng font con (chỉ ký tự dùng).
const PAGE_W = 595;
const PAGE_H = 842;
const M = 40;
const NAVY = rgb(0.07, 0.16, 0.27);
const GREY = rgb(0.4, 0.43, 0.48);
const LINE = rgb(0.85, 0.87, 0.9);
const FLAME = rgb(0.9, 0.36, 0.1);

const PHOTO_LABEL: Record<string, string> = {
  created_by_agency: "Khi tạo đơn",
  created_by_bay: "Khi tạo đơn",
  package_received: "Nhận kiện tại kho",
  checked: "Kiểm hàng",
  weighed: "Cân hàng",
  to_airport: "Ra sân bay",
};

async function loadImageJpeg(id: string): Promise<Buffer | null> {
  try {
    let data: Buffer | null = (await readSavedImage(id))?.data ?? null;
    if (!data) {
      const res = await fetchBayImage(id);
      if (!res.ok) return null;
      data = Buffer.from(await res.arrayBuffer());
    }
    return await sharp(data).rotate().resize({ width: 560, height: 560, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 65, mozjpeg: true }).toBuffer();
  } catch {
    return null;
  }
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export async function buildBayPdf(opts: {
  falcoCode: string;
  shipment: BayShipment | null;
  tracking: BayTracking;
  statusLabel: string;
}): Promise<Uint8Array> {
  const { falcoCode, shipment, tracking: t } = opts;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const root = process.cwd();
  const [reg, bold, logoPng] = await Promise.all([
    readFile(path.join(root, "public/fonts/Roboto-Regular.ttf")),
    readFile(path.join(root, "public/fonts/Roboto-Bold.ttf")),
    readFile(path.join(root, "public/falco-logo.png")),
  ]);
  const font = await pdf.embedFont(reg, { subset: true });
  const fontB = await pdf.embedFont(bold, { subset: true });
  const logo = await pdf.embedPng(await sharp(logoPng).resize(160, 160, { fit: "inside" }).png({ compressionLevel: 9 }).toBuffer());

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;
  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;
  };
  const need = (h: number) => {
    if (y - h < M) newPage();
  };

  // Đầu trang: logo + tiêu đề.
  page.drawImage(logo, { x: M, y: y - 44, width: 44, height: 44 });
  page.drawText("FALCO EXPRESS", { x: M + 54, y: y - 20, size: 16, font: fontB, color: NAVY });
  page.drawText("Hành trình vận đơn", { x: M + 54, y: y - 38, size: 10.5, font, color: GREY });
  const code = falcoCode;
  page.drawText(code, { x: PAGE_W - M - fontB.widthOfTextAtSize(code, 15), y: y - 20, size: 15, font: fontB, color: FLAME });
  const st = opts.statusLabel;
  page.drawText(st, { x: PAGE_W - M - font.widthOfTextAtSize(st, 10.5), y: y - 38, size: 10.5, font, color: GREY });
  y -= 56;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: LINE });
  y -= 18;

  // Thông tin chung.
  const a = shipment?.recipient.address;
  const rows: [string, string][] = [
    ["Người nhận", shipment?.recipient.name ?? ""],
    ["Địa chỉ", a ? [a.line1, a.houseNumber, a.postalCode, a.city, a.countryCode].filter(Boolean).join(", ") : ""],
    ["Hãng giao cuối", t.carrier.code ? `${t.carrier.code.toUpperCase()} ${t.carrier.trackingNumber ?? ""}`.trim() : ""],
    ["Cân nặng", shipment?.parcel.weightKg.total != null ? `${shipment.parcel.weightKg.total} kg` : ""],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    const lines = wrap(v, font, 10.5, PAGE_W - 2 * M - 100);
    need(lines.length * 14 + 2);
    page.drawText(k, { x: M, y: y - 10, size: 10, font, color: GREY });
    lines.forEach((l, i) => page.drawText(l, { x: M + 100, y: y - 10 - i * 14, size: 10.5, font: fontB, color: NAVY }));
    y -= lines.length * 14 + 4;
  }
  y -= 8;
  need(30);
  page.drawText("Quá trình vận chuyển", { x: M, y: y - 12, size: 12.5, font: fontB, color: NAVY });
  y -= 26;

  // Các mốc (cũ → mới), kèm ảnh.
  const events = [...t.events].sort((x, y2) => x.occurredAt.localeCompare(y2.occurredAt));
  const seen = new Set<string>();
  const COLS = 3;
  const GAP = 8;
  const CELL = (PAGE_W - 2 * M - 16 - GAP * (COLS - 1)) / COLS;

  const drawEvent = async (title: string, time: string, location: string | null, urls: string[], label: string) => {
    need(40);
    page.drawCircle({ x: M + 4, y: y - 6, size: 3.2, color: FLAME });
    page.drawText(title, { x: M + 16, y: y - 9, size: 11, font: fontB, color: NAVY });
    const meta = `${time}${location ? ` · ${location}` : ""}`;
    page.drawText(meta, { x: M + 16, y: y - 22, size: 9, font, color: GREY });
    y -= 30;
    const ids = [...new Set(urls.map((u) => bayImageUuid(u)).filter((i): i is string => !!i && !seen.has(i)))];
    ids.forEach((i) => seen.add(i));
    const imgs = (await Promise.all(ids.map(loadImageJpeg))).filter((b): b is Buffer => !!b);
    for (let i = 0; i < imgs.length; i += COLS) {
      const row = await Promise.all(imgs.slice(i, i + COLS).map((b) => pdf.embedJpg(b)));
      const dims = row.map((im) => im.scale(Math.min(CELL / im.width, CELL / im.height)));
      const h = Math.max(...dims.map((d) => d.height));
      need(h + 14);
      dims.forEach((d, k) => page.drawImage(row[k], { x: M + 16 + k * (CELL + GAP), y: y - d.height, width: d.width, height: d.height }));
      y -= h + 6;
    }
    if (imgs.length) {
      page.drawText(`${imgs.length} ảnh — ${label}`, { x: M + 16, y: y - 8, size: 8.5, font, color: GREY });
      y -= 14;
    }
    y -= 6;
  };

  for (const e of events) {
    const title = e.source === "bay" ? (BAY_EVENT_VI[e.code] ?? "Đang xử lý") : (e.description ?? e.code);
    await drawEvent(title, toVnTime(e.occurredAt), e.location ? `${e.location}${e.countryCode ? `, ${e.countryCode}` : ""}` : null, e.images ?? [], PHOTO_LABEL[e.code] ?? "ảnh hàng");
  }
  // Ảnh nhận kiện chưa gắn vào mốc nào.
  const extra = t.receiveItems.flatMap((r) => r.images ?? []);
  if (extra.some((u) => { const i = bayImageUuid(u); return i && !seen.has(i); })) {
    await drawEvent("Ảnh nhận kiện tại kho", "", null, extra, "ảnh hàng");
  }

  // Chân trang mỗi trang.
  const pages = pdf.getPages();
  const label = (BAY_STATUS_LABELS as Record<string, string>)[String(t.shipmentStatus)] ?? "";
  pages.forEach((p, i) => {
    p.drawText(`Falco Express · ${code}${label ? ` · ${label}` : ""}`, { x: M, y: 20, size: 8, font, color: GREY });
    const n = `${i + 1}/${pages.length}`;
    p.drawText(n, { x: PAGE_W - M - font.widthOfTextAtSize(n, 8), y: 20, size: 8, font, color: GREY });
  });
  return pdf.save();
}
