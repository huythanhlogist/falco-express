import DeliveryFunnelCard from "@/components/admin/dashboard/DeliveryFunnelCard";
import KpiStack from "@/components/admin/dashboard/KpiStack";
import RangeSelector from "@/components/admin/dashboard/RangeSelector";
import MonthSelect from "@/components/admin/dashboard/MonthSelect";
import RoutesBreakdownCard from "@/components/admin/dashboard/RoutesBreakdownCard";
import TodayCard from "@/components/admin/dashboard/TodayCard";
import WeeklyWaffleChart from "@/components/admin/dashboard/WeeklyWaffleChart";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminTongQuanPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params.range);

  return (
    <div className="mx-auto flex max-w-[1220px] flex-col gap-[18px] pb-4">
      {/* Tiêu đề trang + bộ chọn khoảng thời gian + ngày hôm nay + chuông cảnh báo */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-[1.3] tracking-[-0.02em] text-[#14181f] sm:text-[28px]">
            Tổng quan
          </h1>
          <p className="mt-1 text-[13.5px] text-[#6b7280]">
            Sản lượng gửi hàng, tiến độ giao nhận và các đơn cần xử lý.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <RangeSelector activeRange={data.range} />
          <MonthSelect value={/^\d{4}-\d{2}$/.test(data.range) ? data.range : null} todayVn={data.todayVn} />


        </div>
      </section>

      {/* Card Hôm nay (3 cột: Đã giao hôm nay · Sắp giao · Cần chú ý) */}
      <TodayCard
        todayDisplayShort={data.todayDisplayShort}
        lastSyncAt={data.lastSyncAt}
        delivered={data.today.delivered}
        upcoming={data.today.upcoming}
        attention={data.today.attention}
      />

      {/* Hàng 1: Biểu đồ sản lượng 11 tuần (waffle) + 3 ô KPI */}
      <section className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[1fr_330px]">
        <WeeklyWaffleChart weeks={data.weekly} />
        <KpiStack kpis={data.kpis} />
      </section>

      {/* Hàng 2: Đơn theo tuyến + Từ nhận hàng đến giao (áp theo ?range=) */}
      <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.42fr_1fr]">
        <RoutesBreakdownCard
          total={data.routes.total}
          rangeShortLabel={data.rangeShortLabel}
          items={data.routes.items}
        />
        <DeliveryFunnelCard funnel={data.funnel} />
      </section>
    </div>
  );
}
