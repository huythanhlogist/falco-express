"use client";

import { useState } from "react";
import { statusClassName, statusLabel, type PaymentStatus } from "@/components/admin/ThuStatusSelect";

type Row = {
  id: number;
  falco_code: string;
  recipient_name: string | null;
  received_date: string | null;
  payment_status: PaymentStatus;
  amount: string | null;
  cost: string | null;
};

export default function AccountingOrderList({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);

  function updateLocal(id: number, field: "amount" | "cost", value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function save(id: number, field: "amount" | "cost", value: string) {
    const num = value.trim() === "" ? null : Number(value);
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: num }),
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
            <th className="px-3 py-2">Mã Falco</th>
            <th className="px-3 py-2">Người nhận</th>
            <th className="px-3 py-2">Ngày nhận</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2">Thu</th>
            <th className="px-3 py-2">Chi</th>
            <th className="px-3 py-2">Lãi/lỗ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const amount = Number(r.amount ?? 0);
            const cost = Number(r.cost ?? 0);
            const profit = amount - cost;
            return (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                <td className="px-3 py-2 font-semibold text-navy-900">{r.falco_code}</td>
                <td className="px-3 py-2 text-ink/70">{r.recipient_name || "—"}</td>
                <td className="px-3 py-2 text-ink/70">
                  {r.received_date ? new Date(r.received_date).toLocaleDateString("vi-VN") : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName(r.payment_status)}`}
                  >
                    {statusLabel(r.payment_status)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={r.amount ?? ""}
                    onChange={(e) => updateLocal(r.id, "amount", e.target.value)}
                    onBlur={(e) => save(r.id, "amount", e.target.value)}
                    placeholder="0"
                    className="w-28 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={r.cost ?? ""}
                    onChange={(e) => updateLocal(r.id, "cost", e.target.value)}
                    onBlur={(e) => save(r.id, "cost", e.target.value)}
                    placeholder="0"
                    className="w-28 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                  />
                </td>
                <td
                  className={`px-3 py-2 font-semibold ${profit >= 0 ? "text-emerald-700" : "text-flame-700"}`}
                >
                  {profit.toLocaleString("vi-VN")}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-8 text-center text-ink/45">
                Không có đơn nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
