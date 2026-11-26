import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import type { BayShipment, BayTracking } from "./bay-api";
import { BAY_EVENT_VI, BAY_PHOTO_LABELS, toVnTime } from "./bay-tracking";
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
const IMAGE_CONCURRENCY = 3;

let cachedAssets: Promise<{ reg: Buffer; bold: Buffer; logo: Buffer }> | null = null;

function loadPdfAssets(): Promise<{ reg: Buffer; bold: Buffer; logo: Buffer }> {
  if (!cachedAssets) {
    cachedAssets = (async () => {
      const root = process.cwd();
      const [reg, bold, rawLogo] = await Promise.all([
        readFile(path.join(root, "public/fonts/Roboto-Regular.ttf")),
        readFile(path.join(root, "public/fonts/Roboto-Bold.ttf")),
        readFile(path.join(root, "public/falco-logo.png")),
      ]);
      const logo = await sharp(rawLogo)
        .resize(160, 160, { fit: "inside" })
        .png({ compressionLevel: 9 })
        .toBuffer();
      return { reg, bold, logo };
    })().catch((err) => {
      cachedAssets = null;
      throw err;
    });
  }
  return cachedAssets;
}

async function loadImageJpeg(id: string): Promise<Buffer | null> {
  try {
    let data: Buffer | null = (await readSavedImage(id))?.data ?? null;
    if (!data) {
      const res = await fetchBayImage(id);
      if (!res.ok) return null;
      data = Buffer.from(await res.arrayBuffer());
    }
    return await sharp(data)
      .rotate()
      .resize({ width: 560, height: 560, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 65, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const out: string[] = [];
  let line = "";
  for (const w of cleaned.split(" ")) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxW) {
      line = candidate;
      continue;
    }
    if (line) {
      out.push(line);
      line = "";
    }
    // Từ quá dài (vd mã vận đơn/URL không có dấu cách): cắt theo ký tự để không tràn lề A4.
    if (font.widthOfTextAtSize(w, size) > maxW) {
      let chunk = "";
      for (const ch of w) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxW && chunk) {
          out.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    } else {
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

function safeTimeMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
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
  const assets = await loadPdfAssets();
  const font = await pdf.embedFont(assets.reg, { subset: true });
  const fontB = await pdf.embedFont(assets.bold, { subset: true });
  const logo = await pdf.embedPng(assets.logo);

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
    const lines = wrap(v, fontB, 10.5, PAGE_W - 2 * M - 100);
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
  const events = [...t.events].sort((x, y2) => safeTimeMs(x.occurredAt) - safeTimeMs(y2.occurredAt));
  const seen = new Set<string>();
  const COLS = 3;
  const GAP = 8;
  const CONTENT_W = PAGE_W - 2 * M - 16;
  const CELL = (CONTENT_W - GAP * (COLS - 1)) / COLS;

  const drawEvent = async (title: string, time: string, location: string | null, urls: string[], label: string) => {
    const titleLines = wrap(title, fontB, 11, CONTENT_W);
    const metaText = `${time}${location ? `${time ? " · " : ""}${location}` : ""}`;
    const metaLines = metaText ? wrap(metaText, font, 9, CONTENT_W) : [];
    const headerHeight = Math.max(1, titleLines.length) * 14 + metaLines.length * 12 + 8;

    need(headerHeight);
    page.drawCircle({ x: M + 4, y: y - 6, size: 3.2, color: FLAME });
    titleLines.forEach((line, idx) => {
      page.drawText(line, { x: M + 16, y: y - 9 - idx * 14, size: 11, font: fontB, color: NAVY });
    });
    const metaStartY = y - 9 - Math.max(1, titleLines.length) * 14 + 1;
    metaLines.forEach((line, idx) => {
      page.drawText(line, { x: M + 16, y: metaStartY - idx * 12, size: 9, font, color: GREY });
    });
    y -= headerHeight;

    const ids = [...new Set(urls.map((u) => bayImageUuid(u)).filter((i): i is string => !!i && !seen.has(i)))];
    ids.forEach((i) => seen.add(i));
    const imgs = (await mapWithConcurrency(ids, IMAGE_CONCURRENCY, loadImageJpeg)).filter((b): b is Buffer => !!b);
    for (let i = 0; i < imgs.length; i += COLS) {
      const row = await Promise.all(imgs.slice(i, i + COLS).map((b) => pdf.embedJpg(b)));
      const dims = row.map((im) => im.scale(Math.min(CELL / im.width, CELL / im.height)));
      const h = Math.max(...dims.map((d) => d.height));
      need(h + 14);
      dims.forEach((d, k) =>
        page.drawImage(row[k], { x: M + 16 + k * (CELL + GAP), y: y - d.height, width: d.width, height: d.height })
      );
      y -= h + 6;
    }
    if (imgs.length) {
      const captionLines = wrap(`${imgs.length} ảnh — ${label}`, font, 8.5, CONTENT_W);
      need(captionLines.length * 11 + 4);
      captionLines.forEach((line, idx) => {
        page.drawText(line, { x: M + 16, y: y - 8 - idx * 11, size: 8.5, font, color: GREY });
      });
      y -= captionLines.length * 11 + 4;
    }
    y -= 6;
  };

  for (const e of events) {
    const title = e.source === "bay" ? (BAY_EVENT_VI[e.code] ?? "Đang xử lý") : (e.description ?? e.code);
    const photoLabel = (BAY_PHOTO_LABELS[e.code] ?? "ảnh hàng").replace(/^Ảnh\s+/i, "");
    await drawEvent(
      title,
      toVnTime(e.occurredAt),
      e.location ? `${e.location}${e.countryCode ? `, ${e.countryCode}` : ""}` : null,
      e.images ?? [],
      photoLabel
    );
  }
  // Ảnh nhận kiện chưa gắn vào mốc nào.
  const extra = t.receiveItems.flatMap((r) => r.images ?? []);
  if (
    extra.some((u) => {
      const i = bayImageUuid(u);
      return i && !seen.has(i);
    })
  ) {
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
