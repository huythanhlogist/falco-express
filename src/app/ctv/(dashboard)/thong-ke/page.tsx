import { redirect } from "next/navigation";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { getCtvCommissionSummary, getCtvRevenueStats } from "@/lib/db";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return `${Math.round(n).toLocaleString("vi-VN")}đ`;
}

export default async function CtvThongKePage() {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/ctv/login");

  const [summary, stats] = await Promise.all([
    getCtvCommissionSummary(session.ctvId),
    getCtvRevenueStats(session.ctvId),
  ]);

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Thống kê</h1>
      <p className="mt-1 text-sm text-ink/55">Doanh thu, sản lượng và hoa hồng — chỉ tính đơn đã được duyệt</p>

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard label="Hoa hồng gốc" value={money(summary.baseCommission)} />
        <StatCard label="Hoa hồng giới thiệu" value={money(summary.overrideCommission)} />
        <StatCard label="Tổng đã trả" value={money(summary.totalPaid)} />
        <StatCard label="Tổng tích luỹ" value={money(summary.totalAccrued)} highlight />
        <StatCard label="Còn phải nhận" value={money(summary.balance)} highlight />
      </div>

      <div className="mt-8">
        <h2 className="font-display text-base font-bold text-navy-900">Doanh thu &amp; sản lượng theo nước</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
                <th className="px-4 py-2.5">Điểm đến</th>
                <th className="px-4 py-2.5">Số đơn</th>
                <th className="px-4 py-2.5">Doanh thu</th>
                <th className="px-4 py-2.5">Sản lượng (kg)</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.destination ?? "unknown"} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-ink/80">{s.destination || "—"}</td>
                  <td className="px-4 py-2.5 text-ink/70">{s.orderCount}</td>
                  <td className="px-4 py-2.5 text-ink/70">{money(s.revenue)}</td>
                  <td className="px-4 py-2.5 text-ink/70">{s.weightKg.toLocaleString("vi-VN")}kg</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink/45">
                    Chưa có đơn nào được duyệt.
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

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
        highlight ? "border-flame-200 bg-flame-50" : "border-line bg-white"
      }`}
    >
      <p className="text-xs text-ink/50">{label}</p>
      <p className={`mt-1 font-display text-base font-bold ${highlight ? "text-flame-700" : "text-navy-900"}`}>
        {value}
      </p>
    </div>
  );
}
