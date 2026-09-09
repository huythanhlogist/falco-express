"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { PencilIcon, TrashIcon, ImageDownloadIcon } from "@/components/icons";
import { PRICE_QUOTE_CONTACT } from "@/lib/constants";
import { FALCO_LOGO_DATA_URI } from "@/lib/falco-logo-data-uri";
import { compositeFalcoLogo } from "@/lib/composite-logo";
import { saveOrDownloadImage } from "@/lib/download-image";
import type { PolicyItem } from "./types";

const CARD_WIDTH = 720;

export default function PolicyManager({ initialItems }: { initialItems: PolicyItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/price-quote/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setItems((prev) => [...prev, { id: json.id, content: newContent.trim() }]);
        setNewContent("");
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: PolicyItem) {
    setEditingId(item.id);
    setEditDraft(item.content);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/price-quote/policy/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editDraft }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, content: editDraft } : i)));
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: number) {
    if (!confirm("Xoá mục chính sách này?")) return;
    const res = await fetch(`/api/admin/price-quote/policy/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function downloadImage() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      // Xem giải thích chi tiết trong PriceQuoteCard.tsx — bỏ cacheBust
      // (gây tải lại toàn bộ font web qua mạng, không cần thiết và dễ
      // treo/chậm), dùng skipFonts để bỏ hẳn bước đó.
      let dataUrl = await toPng(cardRef.current, {
        width: CARD_WIDTH,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true,
      });
      if (logoRef.current) {
        dataUrl = await compositeFalcoLogo(dataUrl, cardRef.current, logoRef.current);
      }
      await saveOrDownloadImage(dataUrl, "falco-chinh-sach-van-chuyen.png");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <form onSubmit={addItem} className="flex flex-wrap items-end gap-2.5 rounded-xl border border-line bg-white p-3.5">
        <div className="min-w-[260px] flex-1">
          <label className="text-xs font-semibold text-ink/60">Thêm mục chính sách</label>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={2}
            placeholder="VD: Falco không nhận vận chuyển hàng cấm..."
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">
          Thêm
        </button>
      </form>

      <div className="mt-3 flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-start gap-2 rounded-xl border border-line bg-white p-3">
            <span className="mt-1 shrink-0 text-xs font-bold text-ink/40">{i + 1}.</span>
            {editingId === item.id ? (
              <div className="flex-1">
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm"
                />
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(item.id)}
                    disabled={saving}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Lưu
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs font-semibold text-ink/50 hover:underline">
                    Huỷ
                  </button>
                </div>
              </div>
            ) : (
              <p className="flex-1 text-sm text-ink/80">{item.content}</p>
            )}
            {editingId !== item.id && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-mist hover:text-navy-800"
                  title="Sửa"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-flame-50 hover:text-flame-700"
                  title="Xoá"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="p-4 text-center text-sm text-ink/45">Chưa có mục chính sách nào.</p>}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={downloadImage} disabled={downloading} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">
          <ImageDownloadIcon className="h-4 w-4" />
          {downloading ? "Đang tạo ảnh..." : "Tải ảnh chính sách"}
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <div ref={cardRef} style={{ width: CARD_WIDTH }} className="bg-white">
          <div className="relative bg-falco-gradient-diag px-6 pb-8 pt-5 text-white">
            <div className="absolute inset-x-0 bottom-0 h-5 rounded-t-3xl bg-white" />
            <div className="flex items-center gap-3">
              {/* Logo hiện trên màn hình bằng background-image; trong ảnh tải về
                  logo được vẽ đè lên sau bằng Canvas API (xem compositeFalcoLogo)
                  vì html-to-image không vẽ được logo vào canvas trên Safari iOS. */}
              <div
                ref={logoRef}
                role="img"
                aria-label="Falco Express"
                className="h-8 w-8 shrink-0 rounded-full bg-white bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${FALCO_LOGO_DATA_URI})`, backgroundSize: "88%" }}
              />
              <div>
                <p className="text-sm font-extrabold tracking-wide">FALCO EXPRESS</p>
                <p className="text-[10px] opacity-85">Chính sách vận chuyển</p>
              </div>
            </div>
          </div>
          <div className="px-6 pb-2 pt-4">
            <ol className="flex flex-col gap-2.5">
              {items.map((item, i) => (
                <li key={item.id} className="flex gap-2 text-[12px] leading-relaxed text-ink/80">
                  <span className="shrink-0 font-bold text-flame-600">{i + 1}.</span>
                  <span>{item.content}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-4 bg-navy-900 px-6 py-3">
            <a
              href={PRICE_QUOTE_CONTACT.zaloHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[12px] font-bold text-white"
            >
              Liên hệ Zalo / SĐT ({PRICE_QUOTE_CONTACT.name}): {PRICE_QUOTE_CONTACT.phone}
            </a>
            <a
              href={PRICE_QUOTE_CONTACT.websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10.5px] font-semibold text-navy-200"
            >
              Tra cứu vận đơn tại: {PRICE_QUOTE_CONTACT.website}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
