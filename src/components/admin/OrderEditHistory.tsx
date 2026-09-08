"use client";

import { useEffect, useState } from "react";

type HistoryEntry = {
  id: number;
  order_id: number;
  action: "update" | "delete";
  before_data: string;
  changed_by: string;
  undone_at: string | null;
  created_at: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export default function OrderEditHistory() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  async function loadHistory() {
    try {
      const res = await fetch("/api/admin/order-edit-history");
      if (!res.ok) return;
      const json = await res.json();
      setHistory(json.history as HistoryEntry[]);
    } catch {
      // Không quan trọng bằng thao tác chính — bỏ qua âm thầm.
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleUndo(h: HistoryEntry) {
    let falcoCode = `#${h.order_id}`;
    try {
      falcoCode = JSON.parse(h.before_data)?.order?.falco_code ?? falcoCode;
    } catch {
      // giữ nguyên fallback
    }
    if (!confirm(`Hoàn tác lượt ${h.action === "delete" ? "xoá" : "sửa"} đơn ${falcoCode}?`)) {
      return;
    }
    setUndoingId(h.id);
    try {
      const res = await fetch(`/api/admin/order-edit-history/${h.id}/undo`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Hoàn tác thất bại");
        return;
      }
      loadHistory();
      // Đơn có thể đã đổi (sửa lại field / tạo lại đơn bị xoá) — reload để
      // các bảng khác trên trang cùng cập nhật theo, đơn giản và chắc chắn
      // hơn là tự đồng bộ state rải rác nhiều nơi.
      window.location.reload();
    } catch {
      alert("Không kết nối được tới máy chủ — thử lại sau");
    } finally {
      setUndoingId(null);
    }
  }

  const visibleHistory = open ? (history ?? []) : (history ?? []).slice(0, 5);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 font-display text-base font-bold text-navy-900"
      >
        Lịch sử chỉnh sửa đơn
        <span className="text-xs font-normal text-ink/40">{open ? "(thu gọn)" : "(xem tất cả)"}</span>
      </button>
      <p className="mt-0.5 text-xs text-ink/50">
        Mỗi lần sửa hoặc xoá đơn (ở Đơn hàng hoặc Kế toán) đều lưu lại ở đây — hoàn tác được nếu lỡ sửa nhầm.
      </p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Mã Falco</th>
              <th className="px-3 py-2">Hành động</th>
              <th className="px-3 py-2">Người sửa</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibleHistory.map((h) => {
              let falcoCode = `#${h.order_id}`;
              try {
                falcoCode = JSON.parse(h.before_data)?.order?.falco_code ?? falcoCode;
              } catch {
                // giữ nguyên fallback
              }
              return (
                <tr key={h.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                  <td className="px-3 py-2 text-ink/70">{formatDateTime(h.created_at)}</td>
                  <td className="px-3 py-2 font-semibold text-navy-900">{falcoCode}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                        h.action === "delete"
                          ? "bg-flame-50 text-flame-700"
                          : "bg-navy-50 text-navy-700"
                      }`}
                    >
                      {h.action === "delete" ? "Đã xoá" : "Đã sửa"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-ink/70">{h.changed_by}</td>
                  <td className="px-3 py-2">
                    {h.undone_at ? (
                      <span className="text-xs text-ink/40">Đã hoàn tác</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUndo(h)}
                        disabled={undoingId === h.id}
                        className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
                      >
                        {undoingId === h.id ? "Đang hoàn tác..." : "Hoàn tác"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {history !== null && history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ink/45">
                  Chưa có lượt sửa/xoá nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
