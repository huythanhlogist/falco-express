"use client";

import { useMemo, useState } from "react";
import { useConfirm, useToast } from "@/components/ui/Toast";

type PayableRow = {
  ctvId: number;
  ctvCode: string;
  fullName: string;
  baseCommission: number;
  overrideCommission: number;
  totalAccrued: number;
  totalPaid: number;
  balance: number;
};

function money(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")}đ`;
}

export default function CtvPayoutManager({ initialPayables }: { initialPayables: PayableRow[] }) {
  const ask = useConfirm();
  const toast = useToast();
  const [payables, setPayables] = useState(initialPayables);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const totals = useMemo(
    () =>
      payables.reduce(
        (acc, row) => ({
          baseCommission: acc.baseCommission + row.baseCommission,
          overrideCommission: acc.overrideCommission + row.overrideCommission,
          totalPaid: acc.totalPaid + row.totalPaid,
          balance: acc.balance + row.balance,
        }),
        { baseCommission: 0, overrideCommission: 0, totalPaid: 0, balance: 0 }
      ),
    [payables]
  );

  function startPay(row: PayableRow) {
    setPayingId(row.ctvId);
    setAmount(String(Math.round(row.balance)));
    setNote("");
    setError("");
  }

  async function submitPay(row: PayableRow) {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      const msg = "Số tiền không hợp lệ";
      setError(msg);
      toast(msg, "error");
      return;
    }

    const roundedBalance = Math.round(row.balance);
    const overWarning =
      amountNum > roundedBalance
        ? `\nLưu ý: Số tiền này lớn hơn số dư còn phải trả (${money(roundedBalance)}).`
        : "";
    const confirmed = await ask(
      `Xác nhận đã trả ${money(amountNum)} hoa hồng cho ${row.ctvCode} (${row.fullName})?${overWarning}\nThao tác này sẽ ghi nhận vào sổ công nợ và không thể hoàn tác.`,
      { confirmLabel: "Xác nhận đã trả", danger: true }
    );
    if (!confirmed) return;

    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/ctv/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ctvId: row.ctvId, amount: amountNum, note }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        summary?: Partial<PayableRow>;
        error?: string;
      };
      if (!res.ok) {
        const msg = json.error || "Không ghi nhận được lần trả hoa hồng";
        setError(msg);
        toast(msg, "error");
        return;
      }
      setPayables((prev) =>
        prev.map((p) => (p.ctvId === row.ctvId ? { ...p, ...(json.summary ?? {}) } : p))
      );
      setPayingId(null);
      toast(`Đã ghi nhận trả ${money(amountNum)} cho ${row.ctvCode}`, "success");
    } catch {
      const msg = "Không kết nối được máy chủ";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const previewAmount = Number(amount);

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#ecece8] bg-white shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-[#ecece8] bg-[#fafaf8] text-left text-xs font-semibold uppercase tracking-wide text-[#8b8d93]">
              <th className="px-4 py-3">FWD</th>
              <th className="px-4 py-3">Hoa hồng gốc</th>
              <th className="px-4 py-3">Hoa hồng giới thiệu</th>
              <th className="px-4 py-3">Đã trả</th>
              <th className="px-4 py-3">Còn phải trả</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {payables.map((row) => {
              const roundedBalance = Math.round(row.balance);
              return (
                <tr key={row.ctvId} className="border-b border-[#ecece8] last:border-0 align-top hover:bg-[#fafaf8]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#132440]">{row.ctvCode}</p>
                    <p className="text-xs text-[#8b8d93]">{row.fullName}</p>
                  </td>
                  <td className="px-4 py-3 text-ink/70 tabular-nums">{money(row.baseCommission)}</td>
                  <td className="px-4 py-3 text-ink/70 tabular-nums">{money(row.overrideCommission)}</td>
                  <td className="px-4 py-3 text-ink/70 tabular-nums">{money(row.totalPaid)}</td>
                  <td className="px-4 py-3 font-bold text-[#132440] tabular-nums">{money(row.balance)}</td>
                  <td className="px-4 py-3">
                    {payingId === row.ctvId ? (
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={submitting}
                          className="w-36 rounded-xl border border-[#e7e7e3] bg-white px-2.5 py-1.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20 disabled:opacity-60"
                        />
                        {Number.isFinite(previewAmount) && previewAmount > 0 && (
                          <p className="text-[11px] font-medium text-[#8b8d93] tabular-nums">
                            = {money(previewAmount)}
                          </p>
                        )}
                        <input
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          disabled={submitting}
                          placeholder="Ghi chú (tuỳ chọn)"
                          className="w-44 rounded-xl border border-[#e7e7e3] bg-white px-2.5 py-1.5 text-xs text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20 disabled:opacity-60"
                        />
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => submitPay(row)}
                            disabled={submitting}
                            className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                          >
                            {submitting ? "Đang lưu…" : "Xác nhận"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPayingId(null);
                              setError("");
                            }}
                            disabled={submitting}
                            className="text-xs font-semibold text-ink/50 hover:underline disabled:opacity-50"
                          >
                            Huỷ
                          </button>
                        </div>
                        {error && <p className="text-xs text-flame-700">{error}</p>}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startPay(row)}
                        disabled={roundedBalance <= 0 || submitting}
                        className="whitespace-nowrap text-xs font-semibold text-[#132440] hover:underline disabled:opacity-30"
                      >
                        Đánh dấu đã trả
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {payables.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8b8d93]">
                  Chưa có dữ liệu công nợ FWD nào.
                </td>
              </tr>
            )}
          </tbody>
          {payables.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#ecece8] bg-[#fafaf8] text-sm font-bold text-[#132440]">
                <td className="px-4 py-3">Tổng cộng ({payables.length} FWD)</td>
                <td className="px-4 py-3 tabular-nums">{money(totals.baseCommission)}</td>
                <td className="px-4 py-3 tabular-nums">{money(totals.overrideCommission)}</td>
                <td className="px-4 py-3 tabular-nums">{money(totals.totalPaid)}</td>
                <td className="px-4 py-3 tabular-nums">{money(totals.balance)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
