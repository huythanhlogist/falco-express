"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

type BillRow = {
  id: number;
  receiver_contact_name: string;
  receiver_country: string;
  shipment_service: string;
  status: "draft" | "sent";
  kango_bill_id: string | null;
  created_at: string;
};

export default function KangoBillsTable({ initialBills }: { initialBills: BillRow[] }) {
  const [bills, setBills] = useState(initialBills);
  const [isPending, startTransition] = useTransition();

  function removeBill(id: number) {
    if (!confirm("Xoá bill này? Không thể hoàn tác.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/kango-bills/${id}`, { method: "DELETE" });
      if (res.ok) setBills((prev) => prev.filter((b) => b.id !== id));
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
            <th className="px-4 py-2.5">ID</th>
            <th className="px-4 py-2.5">Người nhận</th>
            <th className="px-4 py-2.5">Nước</th>
            <th className="px-4 py-2.5">Dịch vụ</th>
            <th className="px-4 py-2.5">Trạng thái</th>
            <th className="px-4 py-2.5">ID bill Kango</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {bills.map((b) => (
            <tr key={b.id} className="border-b border-line last:border-0 hover:bg-mist/40">
              <td className="px-4 py-2.5 text-ink/60">#{b.id}</td>
              <td className="px-4 py-2.5 font-semibold text-navy-800">{b.receiver_contact_name}</td>
              <td className="px-4 py-2.5 text-ink/70">{b.receiver_country}</td>
              <td className="px-4 py-2.5 text-ink/70">{b.shipment_service}</td>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    b.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-mist text-ink/50"
                  }`}
                >
                  {b.status === "sent" ? "Đã gửi Kango" : "Nháp"}
                </span>
              </td>
              <td className="px-4 py-2.5 text-ink/70">{b.kango_bill_id || "—"}</td>
              <td className="px-4 py-2.5 text-right">
                <div className="flex items-center justify-end gap-3">
                  <Link href={`/admin/kango-bills/${b.id}`} className="text-xs font-semibold text-navy-700 hover:underline">
                    Xem/Sửa
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeBill(b.id)}
                    disabled={isPending}
                    className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
                  >
                    Xoá
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {bills.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-ink/45">
                Chưa có bill nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
