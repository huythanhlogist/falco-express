"use client";

import { useEffect, useState } from "react";
import { TrashIcon, ImageDownloadIcon } from "@/components/icons";
import { saveOrDownloadImage } from "@/lib/download-image";

type DbnQuote = {
  id: number;
  customer_name: string;
  quote_date: string;
  total_amount: string;
  created_by: string;
  created_at: string;
};

function sanitizeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "").trim();
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function DbnHistory() {
  const [quotes, setQuotes] = useState<DbnQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  function load() {
    setError("");
    fetch("/api/admin/dbn")
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) {
          setError(json.error || "Không tải được lịch sử");
          return;
        }
        setQuotes(json.quotes ?? []);
      })
      .catch(() => setError("Không tải được lịch sử"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function redownload(q: DbnQuote) {
    setDownloadingId(q.id);
    try {
      const res = await fetch(`/api/admin/dbn/${q.id}/image`);
      if (!res.ok) {
        alert("Không tìm thấy ảnh — DBN này có thể chưa từng bấm 'Tải ảnh'.");
        return;
      }
      const blob = await res.blob();
      const dataUrl = URL.createObjectURL(blob);
      const dbnCode = String(q.id).padStart(4, "0");
      await saveOrDownloadImage(dataUrl, `DBN - ${dbnCode} - ${sanitizeFilename(q.customer_name)}.png`);
      URL.revokeObjectURL(dataUrl);
    } finally {
      setDownloadingId(null);
    }
  }

  async function remove(id: number) {
    if (!confirm("Xoá DBN này? Không hoàn tác được.")) return;
    const res = await fetch(`/api/admin/dbn/${id}`, { method: "DELETE" });
    if (res.ok) {
      setQuotes((prev) => prev.filter((q) => q.id !== id));
    } else {
      alert("Xoá thất bại");
    }
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy-900">10 DBN gần nhất</h2>
        <button type="button" onClick={load} className="text-xs font-medium text-flame-700 hover:underline">
          Tải lại
        </button>
      </div>
      <p className="mt-1 text-xs text-ink/50">Chỉ lưu 10 bản gần nhất — cũ hơn tự động bị xoá.</p>

      {loading && <p className="mt-3 text-xs text-ink/55">Đang tải...</p>}
      {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}
      {!loading && !error && quotes.length === 0 && <p className="mt-3 text-xs text-ink/55">Chưa có DBN nào.</p>}

      <ul className="mt-3 flex flex-col divide-y divide-line">
        {quotes.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                DBN #{String(q.id).padStart(4, "0")} — {q.customer_name}
              </p>
              <p className="mt-0.5 text-xs text-ink/50">
                {formatDate(q.created_at)} · {q.created_by} · Tổng: {Number(q.total_amount).toLocaleString("vi-VN")}đ
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => redownload(q)}
                disabled={downloadingId === q.id}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink/40 hover:bg-flame-50 hover:text-flame-700 disabled:opacity-50"
                title="Tải lại ảnh"
              >
                <ImageDownloadIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(q.id)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-ink/40 hover:bg-flame-50 hover:text-flame-700"
                title="Xoá"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
