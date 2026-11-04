"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { PriceQuoteCategory } from "./types";

export default function PriceQuoteCategoryEditModal({
  category,
  onClose,
  onSaved,
}: {
  category: PriceQuoteCategory;
  onClose: () => void;
  onSaved: (updated: { title: string; note: string | null }) => void;
}) {
  const [title, setTitle] = useState(category.title);
  const [note, setNote] = useState(category.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/price-quote/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, note: note || null }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Không lưu được thay đổi");
        return;
      }
      onSaved({ title, note: note || null });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={saving}
      title="Sửa nhóm giá"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-outline !px-4 !py-2 text-sm">
            Huỷ
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary !px-5 !py-2 text-sm disabled:opacity-60">
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </>
      }
    >
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-semibold text-ink/60">Tên nhóm</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink/60">Ghi chú (tuỳ chọn)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
        />
      </div>
    </div>

      {error && <p className="mt-3 text-xs font-medium text-flame-700" role="alert">{error}</p>}
    </Modal>
  );
}
