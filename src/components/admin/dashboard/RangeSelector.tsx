import Link from "next/link";
import type { DashboardRange } from "@/lib/dashboard";

const OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "30d", label: "30 ngày" },
  { value: "quarter", label: "Quý" },
  { value: "year", label: "Năm" },
];

export default function RangeSelector({ activeRange }: { activeRange: DashboardRange }) {
  return (
    <div
      role="group"
      aria-label="Khoảng thời gian thống kê tuyến và quy trình"
      className="inline-flex items-center gap-0.5 rounded-xl bg-[#ebebea] p-[3px]"
    >
      {OPTIONS.map((opt) => {
        const isActive = opt.value === activeRange;
        return (
          <Link
            key={opt.value}
            href={`/admin/tong-quan?range=${opt.value}`}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex h-8 items-center rounded-[9px] px-3.5 text-[13px] transition-colors ${
              isActive
                ? "bg-[#132440] font-semibold text-white"
                : "font-medium text-[#52525b] hover:text-[#14181f]"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
