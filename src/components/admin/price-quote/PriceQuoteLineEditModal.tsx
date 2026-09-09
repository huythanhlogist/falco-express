"use client";

import { useState } from "react";
import type { PriceQuoteLine } from "./types";

export default function PriceQuoteLineEditModal({
  line,
  onClose,
  onSaved,
}: {
  line: PriceQuoteLine;
  onClose: () => void;
  onSaved: (updated: Partial<PriceQuoteLine>) => void;
}) {
  const [title, setTitle] = useState(line.title);
  const [countries, setCountries] = useState(line.countries ?? "");
  const [minWeightKg, setMinWeightKg] = useState(line.minWeightKg?.toString() ?? "");
  const [markupFlatVnd, setMarkupFlatVnd] = useState(line.markupFlatVnd);
  const [markupPerKgVnd, setMarkupPerKgVnd] = useState(line.markupPerKgVnd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/price-quote/lines/${line.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          countries: countries || null,
          minWeightKg: minWeightKg ? Number(minWeightKg) : null,
          markupFlatVnd,
          markupPerKgVnd,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Không lưu được thay đổi");
        return;
      }
      onSaved({
        title,
        countries: countries || null,
        minWeightKg: minWeightKg ? Number(minWeightKg) : null,
        markupFlatVnd,
        markupPerKgVnd,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display text-sm font-bold text-navy-900">Sửa dòng giá</p>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-ink/60">Tiêu đề</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">Danh sách quốc gia (hiển thị dưới tiêu đề)</label>
            <input
              type="text"
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">Cân tối thiểu (kg, để trống nếu không giới hạn)</label>
            <input
              type="number"
              value={minWeightKg}
              onChange={(e) => setMinWeightKg(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink/60">Markup mặc định — cân lẻ (đ)</label>
              <input
                type="number"
                value={markupFlatVnd}
                onChange={(e) => setMarkupFlatVnd(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/60">Markup mặc định — /kg (21kg+)</label>
              <input
                type="number"
                value={markupPerKgVnd}
                onChange={(e) => setMarkupPerKgVnd(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
              />
            </div>
          </div>
          <p className="text-xs text-ink/45">
            Đây là mức markup MẶC ĐỊNH mỗi lần mở thẻ này — khác với chỉnh tạm ngay trên thẻ lúc báo giá cho từng
            khách (không lưu lại).
          </p>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-outline !px-4 !py-2 text-sm">
            Huỷ
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
