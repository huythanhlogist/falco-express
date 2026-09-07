"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

export default function MonthFilterSelect({
  months,
  paramName = "month",
  value,
}: {
  months: string[];
  paramName?: string;
  /** Ghi đè giá trị hiển thị — dùng khi trang đã áp mặc định (vd tháng hiện tại) dù URL chưa có param. */
  value?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = value ?? searchParams.get(paramName) ?? "";

  function change(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(paramName, value);
    else params.delete(paramName);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
    >
      <option value="">Tất cả các tháng</option>
      {months.map((m) => (
        <option key={m} value={m}>
          {formatMonthLabel(m)}
        </option>
      ))}
    </select>
  );
}
