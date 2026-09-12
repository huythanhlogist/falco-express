"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { FALCO_LOGO_DATA_URI } from "@/lib/falco-logo-data-uri";
import { compositeFalcoLogo } from "@/lib/composite-logo";
import { saveOrDownloadImage } from "@/lib/download-image";
import { loadDraft, saveDraft, clearDraft } from "@/lib/session-draft";
import { TrashIcon, ImageDownloadIcon, SearchIcon } from "@/components/icons";

const CARD_WIDTH = 1000;
const UNDER_FLAT_PRICE_KG = 21; // <21kg = giá cố định, không nhập đơn giá/kg
const DRAFT_KEY = "falco-dbn-draft";

type OrderSearchResult = {
  id: number;
  falco_code: string;
  recipient_name: string | null;
  destination: string | null;
  weight_kg: string | null;
};

type RowState = {
  orderId: number | null;
  label: string;
  loaiHang: string;
  kichThuoc: string;
  dimKg: string;
  canThucKg: string;
  donGiaPerKg: string;
  phuPhi: string;
  thanhTien: string;
  ghiChu: string;
};

function emptyRow(): RowState {
  return {
    orderId: null,
    label: "",
    loaiHang: "",
    kichThuoc: "",
    dimKg: "",
    canThucKg: "",
    donGiaPerKg: "",
    phuPhi: "",
    thanhTien: "",
    ghiChu: "",
  };
}

function isUnderFlatPrice(row: RowState): boolean {
  const kg = Number(row.canThucKg);
  return row.canThucKg !== "" && kg > 0 && kg < UNDER_FLAT_PRICE_KG;
}

function money(n: number): string {
  return n.toLocaleString("vi-VN");
}

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function sanitizeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "").trim();
}

export default function DbnForm() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [quoteDate, setQuoteDate] = useState(todayIso());
  const [rows, setRows] = useState<RowState[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OrderSearchResult[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);

  const [created, setCreated] = useState<{ id: number; dbnCode: string; customerName: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  const [draftLoaded, setDraftLoaded] = useState(false);

  // Khôi phục nháp đang gõ dở (nếu có) khi vào lại trang — vd chuyển sang
  // tab "Đơn hàng" tra cứu gì đó rồi quay lại "Tạo DBN".
  useEffect(() => {
    const draft = loadDraft<{
      customerName: string;
      customerPhone: string;
      customerEmail: string;
      quoteDate: string;
      rows: RowState[];
    }>(DRAFT_KEY);
    if (draft) {
      setCustomerName(draft.customerName ?? "");
      setCustomerPhone(draft.customerPhone ?? "");
      setCustomerEmail(draft.customerEmail ?? "");
      setQuoteDate(draft.quoteDate || todayIso());
      setRows(draft.rows && draft.rows.length ? draft.rows : [emptyRow()]);
    }
    setDraftLoaded(true);
  }, []);

  // Tự lưu nháp mỗi khi form thay đổi — bỏ qua lúc chưa khôi phục xong
  // (tránh ghi đè nháp cũ bằng state rỗng ban đầu) và lúc đã tạo xong DBN
  // (đang xem preview, không còn là "đang gõ dở" nữa).
  useEffect(() => {
    if (!draftLoaded || created) return;
    saveDraft(DRAFT_KEY, { customerName, customerPhone, customerEmail, quoteDate, rows });
  }, [draftLoaded, created, customerName, customerPhone, customerEmail, quoteDate, rows]);

  function updateRow(index: number, patch: Partial<RowState>) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        // Tự tính THÀNH TIỀN khi đã có đơn giá/kg (đơn >=21kg) — đơn <21kg
        // để trống đơn giá thì THÀNH TIỀN luôn nhập tay (giá cố định).
        if (next.donGiaPerKg !== "" && next.canThucKg !== "") {
          const total = Number(next.canThucKg) * Number(next.donGiaPerKg) + (Number(next.phuPhi) || 0);
          if (Number.isFinite(total)) next.thanhTien = String(Math.round(total));
        }
        return next;
      })
    );
  }

  function orderToRow(order: OrderSearchResult): RowState {
    return {
      ...emptyRow(),
      orderId: order.id,
      label: order.recipient_name || order.falco_code,
      canThucKg: order.weight_kg ? String(Number(order.weight_kg)) : "",
      ghiChu: order.destination || "",
    };
  }

  function addSelectedOrders() {
    const toAdd = searchResults.filter((o) => selectedOrderIds.has(o.id)).map(orderToRow);
    if (toAdd.length === 0) return;
    setRows((prev) => [...prev.filter((r) => r.label.trim() || r.loaiHang.trim() || r.orderId), ...toAdd]);
    setSelectedOrderIds(new Set());
  }

  function toggleOrderSelected(id: number) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/orders?q=${encodeURIComponent(searchQuery.trim())}`);
      const json = await res.json();
      setSearchResults(json.orders ?? []);
      setSelectedOrderIds(new Set());
    } finally {
      setSearching(false);
    }
  }

  const total = rows.reduce((sum, r) => sum + (Number(r.thanhTien) || 0), 0);

  async function submit() {
    setError("");
    if (!customerName.trim()) {
      setError("Vui lòng nhập tên khách hàng");
      return;
    }
    const validRows = rows.filter((r) => r.label.trim());
    if (validRows.length === 0) {
      setError("Cần ít nhất 1 dòng có tên/mã đơn hàng");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/dbn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone: customerPhone || null,
          customerEmail: customerEmail || null,
          quoteDate,
          rows: validRows.map((r) => ({
            orderId: r.orderId,
            label: r.label,
            loaiHang: r.loaiHang,
            kichThuoc: r.kichThuoc,
            dimKg: r.dimKg === "" ? null : Number(r.dimKg),
            canThucKg: r.canThucKg === "" ? null : Number(r.canThucKg),
            donGiaPerKg: r.donGiaPerKg === "" ? null : Number(r.donGiaPerKg),
            phuPhi: Number(r.phuPhi) || 0,
            thanhTien: Number(r.thanhTien) || 0,
            ghiChu: r.ghiChu,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Tạo DBN thất bại");
        return;
      }
      setCreated({ id: json.id, dbnCode: json.dbnCode, customerName: customerName.trim() });
      clearDraft(DRAFT_KEY);
    } finally {
      setSaving(false);
    }
  }

  async function downloadImage() {
    if (!cardRef.current || !created) return;
    setDownloading(true);
    try {
      let dataUrl = await toPng(cardRef.current, {
        width: CARD_WIDTH,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true,
      });
      if (logoRef.current) {
        dataUrl = await compositeFalcoLogo(dataUrl, cardRef.current, logoRef.current);
      }

      const filename = `DBN - ${created.dbnCode} - ${sanitizeFilename(created.customerName)}.png`;
      await saveOrDownloadImage(dataUrl, filename);

      const blob = await (await fetch(dataUrl)).blob();
      await fetch(`/api/admin/dbn/${created.id}`, { method: "PATCH", body: blob });
    } finally {
      setDownloading(false);
    }
  }

  function startNew() {
    setCreated(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setQuoteDate(todayIso());
    setRows([emptyRow()]);
    setSearchQuery("");
    setSearchResults([]);
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-mist/50 p-4">
          <p className="text-sm font-semibold text-navy-900">
            Đã tạo DBN #{created.dbnCode} cho {created.customerName}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={downloadImage}
              disabled={downloading}
              className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50"
            >
              <ImageDownloadIcon className="h-4 w-4" />
              {downloading ? "Đang tạo ảnh..." : "Tải ảnh gửi khách"}
            </button>
            <button type="button" onClick={startNew} className="btn-outline !px-5 !py-2.5 text-sm">
              Tạo DBN khác
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-line">
          <div ref={cardRef} style={{ width: CARD_WIDTH }} className="bg-white p-8 text-[13px] text-ink">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <div
                ref={logoRef}
                role="img"
                aria-label="Falco Express"
                className="h-10 w-10 shrink-0 rounded-full bg-navy-900 bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${FALCO_LOGO_DATA_URI})`, backgroundSize: "88%" }}
              />
              <div>
                <p className="font-display text-base font-extrabold text-navy-900">FALCO EXPRESS</p>
                <p className="text-xs text-ink/55">Kết nối giá trị – Giao hàng tận tâm</p>
              </div>
              <p className="ml-auto text-xs text-ink/55">
                Ngày: <span className="font-semibold text-ink">{quoteDate.split("-").reverse().join("/")}</span>
              </p>
            </div>

            <h1 className="mt-4 text-center font-display text-lg font-extrabold uppercase text-navy-900">
              Báo giá cước vận chuyển
            </h1>
            <p className="mt-3">
              Kính gửi: <span className="font-semibold">Anh/Chị {customerName}</span>
              {customerPhone && <> — SĐT: {customerPhone}</>}
              {customerEmail && <> — Email: {customerEmail}</>}
            </p>
            <p className="mt-2 text-ink/70">
              Lời đầu tiên, xin trân trọng cảm ơn quý khách hàng đã quan tâm đến sản phẩm của công ty chúng
              tôi. FALCO xin gửi đến quý khách hàng bảng báo giá cước vận chuyển với chi tiết như sau:
            </p>

            <table className="mt-4 w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-navy-900 text-white">
                  <th className="border border-line px-2 py-1.5">STT</th>
                  <th className="border border-line px-2 py-1.5">MÃ ĐƠN HÀNG</th>
                  <th className="border border-line px-2 py-1.5">LOẠI HÀNG</th>
                  <th className="border border-line px-2 py-1.5">KÍCH THƯỚC (LxWxH)</th>
                  <th className="border border-line px-2 py-1.5">DIM (kg)</th>
                  <th className="border border-line px-2 py-1.5">CÂN THỰC (kg)</th>
                  <th className="border border-line px-2 py-1.5">ĐƠN GIÁ (vnd/kg)</th>
                  <th className="border border-line px-2 py-1.5">PHỤ PHÍ</th>
                  <th className="border border-line px-2 py-1.5">THÀNH TIỀN</th>
                  <th className="border border-line px-2 py-1.5">GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.label.trim())
                  .map((r, i) => (
                    <tr key={i} className="text-center">
                      <td className="border border-line px-2 py-1.5">{i + 1}</td>
                      <td className="border border-line px-2 py-1.5 text-left">{r.label}</td>
                      <td className="border border-line px-2 py-1.5 text-left">{r.loaiHang || "-"}</td>
                      <td className="border border-line px-2 py-1.5">{r.kichThuoc || "-"}</td>
                      <td className="border border-line px-2 py-1.5">{r.dimKg || "-"}</td>
                      <td className="border border-line px-2 py-1.5">{r.canThucKg || "-"}</td>
                      <td className="border border-line px-2 py-1.5">
                        {isUnderFlatPrice(r) ? "Giá cố định" : r.donGiaPerKg ? money(Number(r.donGiaPerKg)) : "-"}
                      </td>
                      <td className="border border-line px-2 py-1.5">{r.phuPhi ? money(Number(r.phuPhi)) : "-"}</td>
                      <td className="border border-line px-2 py-1.5 font-semibold">{money(Number(r.thanhTien) || 0)}</td>
                      <td className="border border-line px-2 py-1.5 text-left">{r.ghiChu || "-"}</td>
                    </tr>
                  ))}
                <tr className="font-bold">
                  <td colSpan={8} className="border border-line px-2 py-1.5 text-right">
                    TỔNG CỘNG:
                  </td>
                  <td className="border border-line px-2 py-1.5 text-center">{money(total)}</td>
                  <td className="border border-line px-2 py-1.5" />
                </tr>
              </tbody>
            </table>

            <div className="mt-4 space-y-1 text-[11px] leading-relaxed text-ink/70">
              <p className="font-semibold text-ink">Ghi chú:</p>
              <p>- Giá trên đã bao gồm phụ phí xăng dầu, chưa bao gồm VAT.</p>
              <p>
                - Trọng lượng tính cước là trị giá lớn hơn giữa cân nặng thực tế và trọng lượng quy đổi
                DIM (dài x rộng x cao / 6000). Đơn hàng &gt;20.5kg Falco làm tròn lên 1kg.
              </p>
              <p>- Thời gian vận chuyển là ngày làm việc, chỉ mang tính tham khảo, không cam kết.</p>
              <p>
                - Đối với hàng dễ vỡ/giá trị cao (&gt;$100/lô), liên hệ Falco để mua bảo hiểm (từ 15% giá trị
                lô hàng, tối đa 1 tỷ đồng).
              </p>
              <p>- Falco không cung cấp dịch vụ ký nhận trực tiếp từ người nhận.</p>
              <p>- Khách hàng tự xác minh địa chỉ trước khi gửi — sai địa chỉ phát sinh chi phí do người gửi chịu.</p>
              <p>- Falco không nhận vận chuyển: thuốc tây, bột trắng, hàng dễ cháy, hàng nguy hiểm, Nicotine, hàng áp suất nén.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-white p-4">
        <h2 className="text-sm font-semibold text-navy-900">Thông tin khách hàng</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink/60">Tên khách hàng *</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Vd: Tâm"
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">SĐT</label>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">Ngày báo giá</label>
            <input
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink/60">Email</label>
            <input
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <h2 className="text-sm font-semibold text-navy-900">Chọn đơn có sẵn để điền nhanh (tuỳ chọn)</h2>
        <div className="mt-2 flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Tìm theo tên người nhận, SĐT, mã Falco..."
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
          />
          <button type="button" onClick={runSearch} disabled={searching} className="btn-outline shrink-0 !px-4 !py-2 text-sm">
            <SearchIcon className="h-4 w-4" />
            {searching ? "..." : "Tìm"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <>
            <p className="mt-3 text-xs text-ink/50">Tick chọn nhiều khách rồi bấm &quot;Thêm đã chọn&quot; — thêm cùng lúc 1 lần.</p>
            <ul className="mt-1 flex flex-col divide-y divide-line">
              {searchResults.map((o) => {
                const checked = selectedOrderIds.has(o.id);
                return (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOrderSelected(o.id)}
                        className="h-4 w-4 shrink-0 rounded border-line text-flame-600 focus:ring-flame-400"
                      />
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-ink">{o.recipient_name || "(chưa có tên)"} — {o.falco_code}</p>
                        <p className="text-xs text-ink/50">
                          {o.destination || "?"} {o.weight_kg ? `· ${o.weight_kg}kg` : ""}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={addSelectedOrders}
              disabled={selectedOrderIds.size === 0}
              className="btn-primary mt-3 !px-4 !py-2 text-sm disabled:opacity-50"
            >
              + Thêm đã chọn ({selectedOrderIds.size})
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">Danh sách đơn trong DBN</h2>
          <button type="button" onClick={() => setRows((prev) => [...prev, emptyRow()])} className="text-xs font-medium text-flame-700 hover:underline">
            + Thêm dòng trống
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-ink/55">
                <th className="w-8 px-1.5 py-1">#</th>
                <th className="px-1.5 py-1">Mã đơn / Tên khách *</th>
                <th className="px-1.5 py-1">Loại hàng</th>
                <th className="px-1.5 py-1">Kích thước</th>
                <th className="w-20 px-1.5 py-1">DIM (kg)</th>
                <th className="w-24 px-1.5 py-1">Cân thực (kg)</th>
                <th className="w-28 px-1.5 py-1">Đơn giá/kg</th>
                <th className="w-24 px-1.5 py-1">Phụ phí</th>
                <th className="w-28 px-1.5 py-1">Thành tiền</th>
                <th className="px-1.5 py-1">Ghi chú</th>
                <th className="w-8 px-1.5 py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const underFlat = isUnderFlatPrice(row);
                return (
                  <tr key={i} className="border-t border-line">
                    <td className="px-1.5 py-1 text-ink/50">{i + 1}</td>
                    <td className="px-1.5 py-1">
                      <input
                        value={row.label}
                        onChange={(e) => updateRow(i, { label: e.target.value })}
                        className="w-full rounded-md border border-line px-2 py-1"
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input value={row.loaiHang} onChange={(e) => updateRow(i, { loaiHang: e.target.value })} className="w-full rounded-md border border-line px-2 py-1" />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        value={row.kichThuoc}
                        onChange={(e) => updateRow(i, { kichThuoc: e.target.value })}
                        placeholder="dài x rộng x cao"
                        className="w-full rounded-md border border-line px-2 py-1"
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input type="number" value={row.dimKg} onChange={(e) => updateRow(i, { dimKg: e.target.value })} className="w-full rounded-md border border-line px-2 py-1" />
                    </td>
                    <td className="px-1.5 py-1">
                      <input type="number" value={row.canThucKg} onChange={(e) => updateRow(i, { canThucKg: e.target.value })} className="w-full rounded-md border border-line px-2 py-1" />
                    </td>
                    <td className="px-1.5 py-1">
                      {underFlat ? (
                        <span className="block rounded-md bg-mist px-2 py-1 text-center text-ink/45">Giá cố định</span>
                      ) : (
                        <input
                          type="number"
                          value={row.donGiaPerKg}
                          onChange={(e) => updateRow(i, { donGiaPerKg: e.target.value })}
                          className="w-full rounded-md border border-line px-2 py-1"
                        />
                      )}
                    </td>
                    <td className="px-1.5 py-1">
                      <input type="number" value={row.phuPhi} onChange={(e) => updateRow(i, { phuPhi: e.target.value })} className="w-full rounded-md border border-line px-2 py-1" />
                    </td>
                    <td className="px-1.5 py-1">
                      <input
                        type="number"
                        value={row.thanhTien}
                        onChange={(e) => updateRow(i, { thanhTien: e.target.value })}
                        className="w-full rounded-md border border-line px-2 py-1 font-semibold"
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <input value={row.ghiChu} onChange={(e) => updateRow(i, { ghiChu: e.target.value })} className="w-full rounded-md border border-line px-2 py-1" />
                    </td>
                    <td className="px-1.5 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-ink/40 hover:text-flame-700"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-right text-sm font-semibold text-navy-900">TỔNG CỘNG: {money(total)}đ</p>

        {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={submit} disabled={saving} className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50">
            {saving ? "Đang tạo..." : "Tạo DBN"}
          </button>
        </div>
      </div>
    </div>
  );
}
