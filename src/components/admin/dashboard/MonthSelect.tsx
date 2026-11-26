"use client";

import { useRouter } from "next/navigation";

/** Chọn 1 tháng cụ thể (12 tháng gần nhất) để lọc "Đơn theo nước" và "Từ nhận hàng đến giao". */
export default function MonthSelect({ value, todayVn }: { value: string | null; todayVn: string }) {
  const router = useRouter();
  const [y, m] = todayVn.split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { ym, label: `Tháng ${d.getUTCMonth() + 1}/${d.getUTCFullYear()}` };
  });
  return (
    <select
      aria-label="Lọc theo tháng"
      value={value ?? ""}
      onChange={(e) => router.push(e.target.value ? `/admin/tong-quan?range=${e.target.value}` : "/admin/tong-quan")}
      className={`h-10 rounded-xl border px-3 text-[13px] font-medium ${
        value ? "border-[#132440] bg-[#132440] text-white" : "border-[#e7e7e3] bg-white text-[#27272a]"
      }`}
    >
      <option value="">Chọn tháng…</option>
      {months.map((mo) => (
        <option key={mo.ym} value={mo.ym}>
          {mo.label}
        </option>
      ))}
    </select>
  );
}
