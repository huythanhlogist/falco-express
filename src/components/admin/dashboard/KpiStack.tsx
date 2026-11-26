import type { DashboardData } from "@/lib/dashboard";

export default function KpiStack({ kpis, selectedMonth = null }: { kpis: DashboardData["kpis"]; selectedMonth?: string | null }) {
  const attentionParts: string[] = [];
  if (kpis.attentionCustoms > 0) attentionParts.push(`${kpis.attentionCustoms} kẹt hải quan`);
  if (kpis.attentionStale > 0) attentionParts.push(`${kpis.attentionStale} chậm cập nhật`);
  if (kpis.attentionFailed > 0) attentionParts.push(`${kpis.attentionFailed} lỗi/hoàn`);

  const deltaColor =
    kpis.monthDeltaPct === null
      ? "text-[#8b8d93]"
      : kpis.monthDeltaPct > 0
        ? "font-semibold text-[#16a34a]"
        : kpis.monthDeltaPct < 0
          ? "font-semibold text-[#ed1c24]"
          : "font-semibold text-[#4b5563]";

  return (
    <div className="flex flex-col gap-3.5">
      {/* KPI 1: Đơn tháng này */}
      <div className="flex flex-1 flex-col justify-center rounded-[24px] border border-[#ecece8] bg-white px-6 py-[18px] shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]">
        <div className="whitespace-nowrap text-[44px] font-bold leading-[1.04] tracking-[-0.04em] text-[#14181f] tabular-nums sm:text-[48px]">
          {kpis.thisMonthOrders.toLocaleString("vi-VN")}
        </div>
        <div className="mt-2 text-[13.5px] font-semibold leading-snug text-[#14181f]">
          {selectedMonth ? `Đơn ${kpis.monthLabel.toLowerCase()}` : "Đơn tháng này"}
        </div>
        <div className="mt-0.5 text-xs leading-snug text-[#8b8d93]">
          {kpis.monthDeltaPct !== null ? (
            <>
              <span className={deltaColor}>
                {kpis.monthDeltaPct > 0 ? `+${kpis.monthDeltaPct}%` : `${kpis.monthDeltaPct}%`}
              </span>{" "}
              so với tháng trước ({kpis.lastMonthOrders.toLocaleString("vi-VN")} đơn)
            </>
          ) : (
            <>{kpis.monthLabel} · Tháng trước chưa có đơn</>
          )}
        </div>
      </div>

      {/* KPI 2: Đang trên đường */}
      <div className="flex flex-1 flex-col justify-center rounded-[24px] border border-[#ecece8] bg-white px-6 py-[18px] shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]">
        <div className="whitespace-nowrap text-[44px] font-bold leading-[1.04] tracking-[-0.04em] text-[#14181f] tabular-nums sm:text-[48px]">
          {kpis.inTransitOrders.toLocaleString("vi-VN")}
        </div>
        <div className="mt-2 text-[13.5px] font-semibold leading-snug text-[#14181f]">
          Đang trên đường
        </div>
        <div className="mt-0.5 text-xs leading-snug text-[#8b8d93]">
          {kpis.inTransitLastMile.toLocaleString("vi-VN")} sắp giao ·{" "}
          {kpis.inTransitCustoms.toLocaleString("vi-VN")} đang thông quan
        </div>
      </div>

      {/* KPI 3: Cần chú ý (ô navy nổi bật) */}
      <a
        href="#hom-nay"
        className="flex flex-1 flex-col justify-center rounded-[24px] bg-[#132440] px-6 py-[18px] text-white shadow-[0_10px_26px_rgba(19,36,64,0.16)] transition-opacity hover:opacity-95"
      >
        <div className="whitespace-nowrap text-[48px] font-bold leading-[1.04] tracking-[-0.04em] text-white tabular-nums sm:text-[52px]">
          {kpis.attentionCount.toLocaleString("vi-VN")}
        </div>
        <div className="mt-2 text-[13.5px] font-semibold leading-snug text-white/95">
          Cần chú ý
        </div>
        <div className="mt-0.5 text-xs leading-snug text-white/70">
          {attentionParts.length > 0 ? attentionParts.join(" · ") : "Tất cả đơn đều đang ổn định"}
        </div>
      </a>
    </div>
  );
}
