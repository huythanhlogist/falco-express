"use client";

import { useConfirm, useToast } from "@/components/ui/Toast";
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

function extractFalcoCode(beforeData: string, orderId: number): string {
  try {
    const parsed = JSON.parse(beforeData);
    return parsed?.order?.falco_code || `#${orderId}`;
  } catch {
    return `#${orderId}`;
  }
}

export default function OrderEditHistory() {
  const ask = useConfirm();
  const toast = useToast();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  async function loadHistory() {
    setLoadError("");
    try {
      const res = await fetch("/api/admin/order-edit-history");
      if (!res.ok) {
        setLoadError("Không tải được lịch sử chỉnh sửa");
        setHistory((prev) => prev ?? []);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setHistory(Array.isArray(json.history) ? (json.history as HistoryEntry[]) : []);
    } catch {
      setLoadError("Không tải được lịch sử chỉnh sửa");
      setHistory((prev) => prev ?? []);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleUndo(h: HistoryEntry) {
    const falcoCode = extractFalcoCode(h.before_data, h.order_id);
    if (!await ask(`Hoàn tác lượt ${h.action === "delete" ? "xoá" : "sửa"} đơn ${falcoCode}?`, { confirmLabel: "Hoàn tác" })) {
      return;
    }
    setUndoingId(h.id);
    try {
      const res = await fetch(`/api/admin/order-edit-history/${h.id}/undo`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error || "Hoàn tác thất bại", "error");
        return;
      }
      toast(`Đã hoàn tác đơn ${falcoCode}`);
      loadHistory();
      // Đơn có thể đã đổi (sửa lại field / tạo lại đơn bị xoá) — reload để
      // các bảng khác trên trang (kể cả Kế toán) cùng cập nhật theo.
      window.location.reload();
    } catch {
      toast("Không kết nối được tới máy chủ — thử lại sau", "error");
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
      {loadError && <p className="mt-2 text-xs font-medium text-flame-700">{loadError}</p>}
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
            {history === null && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-xs text-ink/45">
                  Đang tải lịch sử...
                </td>
              </tr>
            )}
            {visibleHistory.map((h) => {
              const falcoCode = extractFalcoCode(h.before_data, h.order_id);
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
