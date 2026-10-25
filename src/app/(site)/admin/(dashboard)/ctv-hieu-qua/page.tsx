import Link from "next/link";
import { getCtvDashboardStats } from "@/lib/db";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")}đ`;
}

function pctChange(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}% so với tháng trước`;
}

export default async function CtvHieuQuaPage() {
  const stats = await getCtvDashboardStats();
  const change = pctChange(stats.thisMonthRevenue, stats.lastMonthRevenue);

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Hiệu quả CTV</h1>
      <p className="mt-1 text-sm text-ink/55">Tổng quan hoạt động kênh cộng tác viên</p>

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Tổng số CTV" value={String(stats.totalCtvs)} />
        <StatCard label="Đang hoạt động" value={String(stats.activeCtvs)} />
        <StatCard label="Doanh thu tháng này" value={money(stats.thisMonthRevenue)} sub={change ?? undefined} />
        <StatCard
          label="Đơn CTV chờ duyệt"
          value={String(stats.pendingReviewCount)}
          highlight={stats.pendingReviewCount > 0}
        />
      </div>

      {stats.pendingReviewCount > 0 && (
        <Link
          href="/admin/orders?source=ctv&status=all"
          className="mt-3 inline-block text-sm font-semibold text-flame-700 hover:underline"
        >
          Xem {stats.pendingReviewCount} đơn CTV đang chờ duyệt →
        </Link>
      )}

      <div className="mt-8">
        <h2 className="font-display text-base font-bold text-navy-900">Top CTV theo doanh thu (đã duyệt)</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
                <th className="px-4 py-2.5">Hạng</th>
                <th className="px-4 py-2.5">CTV</th>
                <th className="px-4 py-2.5">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {stats.topCtvs.map((c, i) => (
                <tr key={c.ctvId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-ink/50">#{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-navy-800">{c.ctvCode}</span>{" "}
                    <span className="text-ink/60">— {c.fullName}</span>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-navy-900">{money(c.revenue)}</td>
                </tr>
              ))}
              {stats.topCtvs.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink/45">
                    Chưa có đơn CTV nào được duyệt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3.5 ${highlight ? "border-flame-200 bg-flame-50" : "border-line bg-white"}`}>
      <p className="text-xs text-ink/50">{label}</p>
      <p className={`mt-1 font-display text-base font-bold ${highlight ? "text-flame-700" : "text-navy-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink/45">{sub}</p>}
    </div>
  );
}
