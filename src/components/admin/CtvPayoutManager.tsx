"use client";

import { useState, useTransition } from "react";

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
  const [payables, setPayables] = useState(initialPayables);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function startPay(row: PayableRow) {
    setPayingId(row.ctvId);
    setAmount(String(Math.round(row.balance)));
    setNote("");
    setError("");
  }

  function submitPay(ctvId: number) {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Số tiền không hợp lệ");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/admin/ctv/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ctvId, amount: amountNum, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Có lỗi xảy ra");
        return;
      }
      setPayables((prev) => prev.map((p) => (p.ctvId === ctvId ? { ...p, ...json.summary } : p)));
      setPayingId(null);
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
            <th className="px-4 py-2.5">CTV</th>
            <th className="px-4 py-2.5">Hoa hồng gốc</th>
            <th className="px-4 py-2.5">Hoa hồng giới thiệu</th>
            <th className="px-4 py-2.5">Đã trả</th>
            <th className="px-4 py-2.5">Còn phải trả</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {payables.map((row) => (
            <tr key={row.ctvId} className="border-b border-line last:border-0 align-top">
              <td className="px-4 py-2.5">
                <p className="font-semibold text-navy-800">{row.ctvCode}</p>
                <p className="text-xs text-ink/50">{row.fullName}</p>
              </td>
              <td className="px-4 py-2.5 text-ink/70">{money(row.baseCommission)}</td>
              <td className="px-4 py-2.5 text-ink/70">{money(row.overrideCommission)}</td>
              <td className="px-4 py-2.5 text-ink/70">{money(row.totalPaid)}</td>
              <td className="px-4 py-2.5 font-bold text-navy-900">{money(row.balance)}</td>
              <td className="px-4 py-2.5">
                {payingId === row.ctvId ? (
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-32 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm"
                    />
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ghi chú (tuỳ chọn)"
                      className="w-40 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submitPay(row.ctvId)}
                        disabled={isPending}
                        className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                      >
                        Xác nhận
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayingId(null)}
                        className="text-xs font-semibold text-ink/50 hover:underline"
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
                    disabled={row.balance <= 0}
                    className="text-xs font-semibold text-navy-700 hover:underline disabled:opacity-30"
                  >
                    Đánh dấu đã trả
                  </button>
                )}
              </td>
            </tr>
          ))}
          {payables.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-ink/45">
                Chưa có CTV nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
