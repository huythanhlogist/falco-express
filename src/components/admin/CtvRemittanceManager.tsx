"use client";

import { useState, useTransition } from "react";

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
  return `${Number(v).toLocaleString("vi-VN")}đ`;
}

export default function CtvRemittanceManager({ initialCollections }: { initialCollections: CollectionRow[] }) {
  const [collections, setCollections] = useState(initialCollections);
  const [isPending, startTransition] = useTransition();

  function confirmRemittance(orderId: number) {
    startTransition(async () => {
      const res = await fetch("/api/admin/ctv/remittances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        setCollections((prev) => prev.filter((c) => c.orderId !== orderId));
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
            <th className="px-4 py-2.5">Mã đơn</th>
            <th className="px-4 py-2.5">CTV</th>
            <th className="px-4 py-2.5">Số tiền thu hộ</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {collections.map((c) => (
            <tr key={c.orderId} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 font-semibold text-navy-900">{c.falcoCode}</td>
              <td className="px-4 py-2.5 text-ink/70">
                {c.ctvCode} — {c.ctvFullName}
              </td>
              <td className="px-4 py-2.5 text-ink/70">{money(c.amount)}</td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => confirmRemittance(c.orderId)}
                  disabled={isPending}
                  className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                >
                  Xác nhận đã nộp
                </button>
              </td>
            </tr>
          ))}
          {collections.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-ink/45">
                Không có khoản thu hộ nào chưa nộp.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
