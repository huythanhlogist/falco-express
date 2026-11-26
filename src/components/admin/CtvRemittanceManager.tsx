"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useConfirm, useToast } from "@/components/ui/Toast";

type CollectionRow = {
  orderId: number;
  falcoCode: string;
  ctvId: number;
  ctvCode: string;
  ctvFullName: string;
  amount: string | null;
};

function money(v: string | null): string {
  if (!v) return "—";
  const num = Number(v);
  if (!Number.isFinite(num)) return "—";
  return `${Math.round(num).toLocaleString("vi-VN")}đ`;
}

export default function CtvRemittanceManager({ initialCollections }: { initialCollections: CollectionRow[] }) {
  const ask = useConfirm();
  const toast = useToast();
  const [collections, setCollections] = useState(initialCollections);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const totalAmount = useMemo(
    () =>
      collections.reduce((sum, item) => {
        const val = Number(item.amount ?? 0);
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0),
    [collections]
  );

  async function confirmRemittance(row: CollectionRow) {
    const confirmed = await ask(
      `Xác nhận FWD ${row.ctvCode} (${row.ctvFullName}) đã nộp ${money(row.amount)} cho đơn ${row.falcoCode}?\nĐơn sẽ chuyển sang trạng thái "Đã thu" và không thể hoàn tác.`,
      { confirmLabel: "Xác nhận đã nộp", danger: true }
    );
    if (!confirmed) return;

    setBusyOrderId(row.orderId);
    try {
      const res = await fetch("/api/admin/ctv/remittances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: row.orderId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(json.error || "Không xác nhận được khoản thu hộ", "error");
        return;
      }
      setCollections((prev) => prev.filter((c) => c.orderId !== row.orderId));
      toast(`Đã xác nhận nộp tiền đơn ${row.falcoCode}`, "success");
    } catch {
      toast("Không kết nối được máy chủ", "error");
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#ecece8] bg-white shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-[#ecece8] bg-[#fafaf8] text-left text-xs font-semibold uppercase tracking-wide text-[#8b8d93]">
              <th className="px-4 py-3">Mã đơn</th>
              <th className="px-4 py-3">FWD</th>
              <th className="px-4 py-3">Số tiền thu hộ</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => {
              const isBusy = busyOrderId === c.orderId;
              return (
                <tr key={c.orderId} className="border-b border-[#ecece8] last:border-0 hover:bg-[#fafaf8]">
                  <td className="px-4 py-3 font-semibold text-[#132440]">
                    <Link
                      href={`/admin/orders?q=${encodeURIComponent(c.falcoCode)}`}
                      className="hover:text-[#f7941d] hover:underline"
                    >
                      {c.falcoCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    <span className="font-semibold text-[#132440]">{c.ctvCode}</span> — {c.ctvFullName}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#14181f] tabular-nums">{money(c.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => confirmRemittance(c)}
                      disabled={isBusy}
                      className="whitespace-nowrap text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                    >
                      {isBusy ? "Đang lưu…" : "Xác nhận đã nộp"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {collections.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#8b8d93]">
                  Chưa có khoản thu hộ nào chưa nộp.
                </td>
              </tr>
            )}
          </tbody>
          {collections.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#ecece8] bg-[#fafaf8] text-sm font-bold text-[#132440]">
                <td className="px-4 py-3" colSpan={2}>
                  Tổng cộng ({collections.length} đơn)
                </td>
                <td className="px-4 py-3 tabular-nums">{`${Math.round(totalAmount).toLocaleString("vi-VN")}đ`}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
