"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { statusClassName, statusLabel, type PaymentStatus } from "@/components/admin/ThuStatusSelect";

type Row = {
  id: number;
  falco_code: string;
  awb: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  destination: string | null;
  parcel_count: number;
  received_date: string | null;
  payment_status: PaymentStatus;
  amount: string | null;
  cost: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function AccountingOrderList({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [saveState, setSaveState] = useState<Record<number, SaveState>>({});

  function updateLocal(id: number, field: "amount" | "cost", value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  // Gửi CẢ amount và cost hiện có của dòng trong 1 request duy nhất (thay vì
  // 1 request riêng cho mỗi ô) — tránh trường hợp 2 request rời rạc chạy
  // chồng chéo khiến 1 trong 2 giá trị (thường là Chi, do gõ sau) không được
  // ghi nhận. Sau khi lưu thành công, làm mới trang để các thẻ tổng kết Thu/
  // Chi/Lãi-lỗ ở đầu trang Kế toán cập nhật ngay, không cần bấm reload tay.
  async function save(row: Row) {
    setSaveState((s) => ({ ...s, [row.id]: "saving" }));
    try {
      const res = await fetch(`/api/admin/orders/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: row.amount?.toString().trim() === "" || row.amount == null ? null : Number(row.amount),
          cost: row.cost?.toString().trim() === "" || row.cost == null ? null : Number(row.cost),
        }),
        keepalive: true,
      });
      if (!res.ok) throw new Error();
      setSaveState((s) => ({ ...s, [row.id]: "saved" }));
      router.refresh();
      setTimeout(() => setSaveState((s) => (s[row.id] === "saved" ? { ...s, [row.id]: "idle" } : s)), 2000);
    } catch {
      setSaveState((s) => ({ ...s, [row.id]: "error" }));
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
            <th className="px-3 py-2">Mã Falco</th>
            <th className="px-3 py-2">AWB</th>
            <th className="px-3 py-2">Người nhận</th>
            <th className="px-3 py-2">Điện thoại</th>
            <th className="px-3 py-2">Điểm đến</th>
            <th className="px-3 py-2">Kiện</th>
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
            const state = saveState[r.id] ?? "idle";
            return (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                <td className="px-3 py-2 font-semibold text-navy-900">{r.falco_code}</td>
                <td className="px-3 py-2 text-ink/70">{r.awb}</td>
                <td className="px-3 py-2 text-ink/70">{r.recipient_name || "—"}</td>
                <td className="px-3 py-2 text-ink/70">{r.recipient_phone || "—"}</td>
                <td className="px-3 py-2 text-ink/70">{r.destination || "—"}</td>
                <td className="px-3 py-2 text-ink/70">{r.parcel_count}</td>
                <td className="px-3 py-2 text-ink/70">
                  {r.received_date ? new Date(r.received_date).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"}
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
                    onBlur={() => save(r)}
                    placeholder="0"
                    className="w-28 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={r.cost ?? ""}
                    onChange={(e) => updateLocal(r.id, "cost", e.target.value)}
                    onBlur={() => save(r)}
                    placeholder="0"
                    className="w-28 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                  />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`font-semibold ${profit >= 0 ? "text-emerald-700" : "text-flame-700"}`}
                  >
                    {profit.toLocaleString("vi-VN")}
                  </span>
                  {state === "saving" && (
                    <span className="ml-2 text-xs text-ink/40">Đang lưu...</span>
                  )}
                  {state === "saved" && (
                    <span className="ml-2 text-xs font-medium text-emerald-600">Đã lưu</span>
                  )}
                  {state === "error" && (
                    <button
                      type="button"
                      onClick={() => save(r)}
                      className="ml-2 text-xs font-medium text-flame-700 underline decoration-dotted"
                    >
                      Lỗi, thử lại
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="px-5 py-8 text-center text-ink/45">
                Không có đơn nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
