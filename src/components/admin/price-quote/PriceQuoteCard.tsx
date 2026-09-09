"use client";

import { Fragment, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { PRICE_QUOTE_CONTACT } from "@/lib/constants";
import { FALCO_LOGO_DATA_URI } from "@/lib/falco-logo-data-uri";
import { compositeFalcoLogo } from "@/lib/composite-logo";
import { saveOrDownloadImage } from "@/lib/download-image";
import { ImageDownloadIcon, PencilIcon, TrashIcon } from "@/components/icons";
import type { PriceQuoteLine } from "./types";

// Chiều rộng CỐ ĐỊNH của khung thẻ (không phụ thuộc màn hình admin đang
// xem) — mọi ảnh PNG tải về đều ra đúng kích thước này để luôn rõ nét và
// đồng nhất khi gửi khách. Khung cuộn ngang trên màn hình hẹp thay vì co
// lại, tránh phải tính toán scale phức tạp mà vẫn giữ đúng kích thước xuất.
const CARD_WIDTH = 860;
const GRID_COLUMNS = 4;

function money(n: number): string {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function buildGrid(rows: { weightLabel: string; priceFinal: number }[]): ({ weightLabel: string; priceFinal: number } | null)[][] {
  const rowsPerCol = Math.ceil(rows.length / GRID_COLUMNS);
  const grid: ({ weightLabel: string; priceFinal: number } | null)[][] = [];
  for (let r = 0; r < rowsPerCol; r++) {
    const line: ({ weightLabel: string; priceFinal: number } | null)[] = [];
    for (let c = 0; c < GRID_COLUMNS; c++) {
      const idx = c * rowsPerCol + r;
      line.push(idx < rows.length ? rows[idx] : null);
    }
    grid.push(line);
  }
  return grid;
}

export default function PriceQuoteCard({
  line,
  onEdit,
  onDelete,
}: {
  line: PriceQuoteLine;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [flatMarkup, setFlatMarkup] = useState(line.markupFlatVnd);
  const [perKgMarkup, setPerKgMarkup] = useState(line.markupPerKgVnd);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const flatRows = line.rows
    .filter((r) => !r.isPerKg)
    .map((r) => ({ weightLabel: r.weightLabel, priceFinal: r.priceOriginal + flatMarkup }));
  const perKgRow = line.rows.find((r) => r.isPerKg);
  const perKgFinal = perKgRow ? perKgRow.priceOriginal + perKgMarkup : null;

  const grid = buildGrid(flatRows);

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      // KHÔNG dùng cacheBust — nó bắt html-to-image tải lại qua mạng TOÀN BỘ
      // font web đang dùng trên trang (hàng chục file .woff2) mỗi lần bấm
      // Tải ảnh, không giúp gì cho logo (logo đã nhúng base64, không cần
      // cache-bust) mà lại làm chậm/dễ treo trên mạng di động (đã bắt được
      // hiện tượng này khi test). skipFonts bỏ hẳn bước nhúng font web —
      // ảnh xuất ra dùng font mặc định của máy thay vì Be Vietnam Pro,
      // đánh đổi lấy tốc độ và độ ổn định, ưu tiên hơn nhiều so với khớp
      // đúng font 100%.
      let dataUrl = await toPng(cardRef.current, {
        width: CARD_WIDTH,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true,
      });
      if (logoRef.current) {
        dataUrl = await compositeFalcoLogo(dataUrl, cardRef.current, logoRef.current);
      }
      const safeName = line.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
      await saveOrDownloadImage(dataUrl, `falco-bao-gia-${safeName || "bang-gia"}.png`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-bold text-navy-900">{line.title}</p>
          {line.countries && <p className="mt-0.5 text-xs text-ink/50">{line.countries}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-mist hover:text-navy-800"
              title="Sửa dòng giá"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-flame-50 hover:text-flame-700"
              title="Xoá dòng giá"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-mist/70 p-3">
        <div>
          <label className="text-xs font-semibold text-ink/60">Phụ phí cân lẻ (đ)</label>
          <input
            type="number"
            value={flatMarkup}
            onChange={(e) => setFlatMarkup(Number(e.target.value) || 0)}
            className="mt-1 w-32 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink/60">Phụ phí /kg (21kg+, đ)</label>
          <input
            type="number"
            value={perKgMarkup}
            onChange={(e) => setPerKgMarkup(Number(e.target.value) || 0)}
            className="mt-1 w-32 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
          />
        </div>
        <p className="text-xs text-ink/45">
          Chỉnh để báo giá riêng cho khách — chỉ áp dụng cho thẻ này, không lưu lại.
        </p>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="btn-primary ml-auto !px-4 !py-2 text-sm disabled:opacity-50"
        >
          <ImageDownloadIcon className="h-4 w-4" />
          {downloading ? "Đang tạo ảnh..." : "Tải ảnh"}
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <div ref={cardRef} style={{ width: CARD_WIDTH }} className="bg-white">
          <div className="relative bg-falco-gradient-diag px-7 pb-10 pt-5 text-white">
            <div className="absolute inset-x-0 bottom-0 h-6 rounded-t-3xl bg-white" />
            <div className="flex items-center gap-3">
              {/* Logo hiện trên MÀN HÌNH bằng background-image bình thường. Còn
                  trong ẢNH TẢI VỀ, logo không lấy từ đây nữa — được vẽ đè lên
                  sau bằng Canvas API (xem compositeFalcoLogo/handleDownload)
                  vì html-to-image không vẽ được logo vào canvas trên Safari
                  iOS dù đã thử nhiều cách nhúng khác nhau. logoRef chỉ để đo
                  đúng vị trí/kích thước hiện tại của khối này. */}
              <div
                ref={logoRef}
                role="img"
                aria-label="Falco Express"
                className="h-9 w-9 shrink-0 rounded-full bg-white bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${FALCO_LOGO_DATA_URI})`, backgroundSize: "88%" }}
              />
              <div>
                <p className="text-sm font-extrabold tracking-wide">FALCO EXPRESS</p>
                <p className="text-[10px] opacity-85">Kết nối giá trị – Giao hàng tận tâm</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-85">Bảng giá</p>
              <h3 className="mt-1 text-2xl font-extrabold leading-tight">{line.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {line.countries && (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[11.5px] font-bold">{line.countries}</span>
                )}
                {line.minWeightKg && (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[11.5px] font-bold">
                    Áp dụng từ {line.minWeightKg}kg trở lên
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-7 pt-1">
            <div className="overflow-hidden rounded-lg border border-navy-900">
              <table className="w-full border-collapse text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr>
                    {Array.from({ length: GRID_COLUMNS }).map((_, i) => (
                      <Fragment key={i}>
                        <th
                          className={`border border-navy-700 bg-navy-900 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white ${i > 0 ? "border-l-2 border-l-navy-600" : ""}`}
                        >
                          Số Kg
                        </th>
                        <th className="border border-navy-700 bg-navy-900 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white">
                          VNĐ
                        </th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((rowGroup, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? "bg-mist/60" : "bg-white"}>
                      {rowGroup.map((cell, ci) => (
                        <Fragment key={ci}>
                          <td
                            className={`border border-line py-1.5 text-center font-bold text-navy-800 ${ci > 0 ? "border-l-2 border-l-navy-100" : ""}`}
                          >
                            {cell?.weightLabel ?? ""}
                          </td>
                          <td className="border border-line py-1.5 text-center font-semibold text-ink">
                            {cell ? money(cell.priceFinal) : ""}
                          </td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {perKgFinal !== null && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-flame-300 bg-flame-50 px-4 py-3">
                <span className="text-[12.5px] font-bold text-flame-800">Từ 21kg trở lên</span>
                <span className="text-base font-extrabold text-flame-700">{money(perKgFinal)} / kg</span>
              </div>
            )}
          </div>

          <div className="mt-5 bg-navy-900 px-7 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href={PRICE_QUOTE_CONTACT.zaloHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-bold text-white"
              >
                Liên hệ Zalo / SĐT ({PRICE_QUOTE_CONTACT.name}): {PRICE_QUOTE_CONTACT.phone}
              </a>
              <span className="text-[10.5px] text-navy-300">
                Cập nhật {new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
              </span>
            </div>
            <a
              href={PRICE_QUOTE_CONTACT.websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[11px] font-semibold text-navy-200"
            >
              Tra cứu vận đơn tại: {PRICE_QUOTE_CONTACT.website}
            </a>
          </div>
          <p className="px-7 pb-5 pt-3 text-[10px] leading-relaxed text-ink/45">
            Giá đã bao gồm phụ phí xăng dầu, chưa gồm VAT. Trọng lượng tính cước là trị giá lớn hơn giữa cân thực tế
            và cân quy đổi thể tích (dài×rộng×cao/6000), đơn hàng &gt;20.5kg làm tròn lên 1kg. Thời gian vận chuyển
            chỉ mang tính tham khảo.
          </p>
        </div>
      </div>
    </div>
  );
}
