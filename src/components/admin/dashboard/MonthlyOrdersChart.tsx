import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard";

/** Cột số đơn 12 tháng + % tăng/giảm so với tháng trước. Bấm cột để lọc cả trang theo tháng đó. */
export default function MonthlyOrdersChart({ months }: { months: DashboardData["monthly"] }) {
  const max = Math.max(...months.map((m) => m.count), 1);
  const total = months.reduce((a, m) => a + m.count, 0);
  const last = months[months.length - 1];
  return (
    <section className="rounded-[24px] border border-[#ecece8] bg-white p-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:px-[26px] sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold leading-snug tracking-[-0.02em] text-[#14181f]">Số đơn theo tháng</h2>
          <p className="mt-0.5 text-[12.5px] text-[#8b8d93]">
            12 tháng · {total.toLocaleString("vi-VN")} đơn · % so với tháng liền trước · bấm cột để xem tháng đó
          </p>
        </div>
        {last && last.deltaPct !== null && (
          <span
            className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${
              last.deltaPct >= 0 ? "bg-[#e8f6ee] text-[#15803d]" : "bg-[#fdecec] text-[#dc2626]"
            }`}
          >
            Tháng {last.label}: {last.deltaPct >= 0 ? "▲ +" : "▼ "}
            {last.deltaPct}%
          </span>
        )}
      </div>

      <div className="mt-5 grid h-[220px] grid-cols-12 items-end gap-2 sm:gap-3">
        {months.map((m) => {
          const h = m.count > 0 ? Math.max(4, Math.round((m.count / max) * 150)) : 2;
          const up = m.deltaPct !== null && m.deltaPct > 0;
          const down = m.deltaPct !== null && m.deltaPct < 0;
          return (
            <Link
              key={m.ym}
              href={`/admin/tong-quan?range=${m.ym}`}
              title={`Tháng ${m.label}: ${m.count} đơn${m.deltaPct !== null ? ` (${m.deltaPct > 0 ? "+" : ""}${m.deltaPct}% so với tháng trước)` : ""}`}
              className="group flex h-full flex-col items-center justify-end gap-1"
            >
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  up ? "text-[#15803d]" : down ? "text-[#dc2626]" : "text-[#a1a1aa]"
                }`}
              >
                {m.deltaPct === null ? (m.count > 0 ? "mới" : "") : `${up ? "▲" : down ? "▼" : "="}${Math.abs(m.deltaPct)}%`}
              </span>
              <span className="text-[13px] font-bold tabular-nums text-[#14181f]">{m.count || ""}</span>
              <span
                className={`w-full max-w-[44px] rounded-t-[8px] transition-opacity group-hover:opacity-80 ${
                  m.isSelected ? "bg-[#2563eb]" : m.count === 0 ? "bg-[#ecece9]" : "bg-[#f7941d]"
                }`}
                style={{ height: `${h}px` }}
              />
              <span className={`text-[11.5px] tabular-nums ${m.isSelected ? "font-bold text-[#14181f]" : "text-[#8b8d93]"}`}>
                {m.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
