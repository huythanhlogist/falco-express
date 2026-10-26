import { redirect } from "next/navigation";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { getCtvFinance } from "@/lib/ctv-portal";
import { statusClassName, statusLabel } from "@/lib/payment-status";

export const dynamic = "force-dynamic";
const money = (v: number | string | null) => (v === null || v === "" ? "—" : `${Math.round(Number(v)).toLocaleString("vi-VN")}đ`);
const dateVn = (v: string | null) => (v ? new Date(v).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—");

export default async function CtvFinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/fwd/login");
  const sp = await searchParams;
  const f = await getCtvFinance(session.ctvId, sp.month ?? "");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Tài chính</h1>
          <p className="mt-1 text-sm text-ink/55">Tiền thu theo đơn, tiền thu hộ đã nộp Falco và sao kê theo tháng</p>
        </div>
        <form className="flex gap-1">
          <input name="month" type="month" defaultValue={f.month} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" />
          <button className="btn-outline !px-3 !py-1.5 text-sm">Xem</button>
          <a href={`/api/ctv/tai-chinh/export?month=${f.month}`} className="btn-primary !px-3 !py-1.5 text-sm">Xuất Excel</a>
        </form>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          ["Tổng tiền thu theo đơn", money(f.totalRevenue), false],
          ["Đã thu hộ khách", money(f.collectedByCtv), false],
          ["Đã nộp Falco", money(f.remitted), false],
          ["Còn phải nộp Falco", money(f.outstanding), true],
        ].map(([label, value, hl]) => (
          <div key={label as string} className={`rounded-xl border p-4 ${hl ? "border-flame-200 bg-flame-50" : "border-line bg-white"}`}>
            <p className="text-xs text-ink/50">{label}</p>
            <p className="mt-1 font-display text-lg font-bold text-navy-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <h2 className="font-semibold text-navy-900">Sao kê tháng {Number(f.month.slice(5))}/{f.month.slice(0, 4)} — {money(f.monthRevenue)}</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
                <th className="px-3 py-2">Ngày</th><th className="px-3 py-2">Mã đơn</th><th className="px-3 py-2">Người nhận</th>
                <th className="px-3 py-2">Điểm đến</th><th className="px-3 py-2">Cân (kg)</th><th className="px-3 py-2">Tiền thu</th>
                <th className="px-3 py-2">Thanh toán</th><th className="px-3 py-2">Ngày thu</th>
              </tr>
            </thead>
            <tbody>
              {f.statement.map((r) => (
                <tr key={r.falco_code} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink/70">{dateVn(r.received_date)}</td>
                  <td className="px-3 py-2 font-semibold text-navy-900">{r.falco_code}</td>
                  <td className="px-3 py-2 text-ink/70">{r.recipient_name || "—"}</td>
                  <td className="px-3 py-2 text-ink/70">{r.destination || "—"}</td>
                  <td className="px-3 py-2 text-ink/70">{r.weight_kg ?? "—"}</td>
                  <td className="px-3 py-2 text-ink/70">{money(r.amount)}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName(r.payment_status)}`}>{statusLabel(r.payment_status)}</span></td>
                  <td className="px-3 py-2 text-ink/70">{dateVn(r.collected_date)}</td>
                </tr>
              ))}
              {f.statement.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-ink/45">Không có đơn trong tháng này.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="font-semibold text-navy-900">Lịch sử nộp tiền cho Falco</h2>
        {f.remittances.length === 0 ? <p className="mt-2 text-sm text-ink/45">Chưa có lần nộp nào.</p> : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white text-sm">
            {f.remittances.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span><b className="text-navy-900">{r.falco_code}</b> {r.note ? <span className="text-ink/50">· {r.note}</span> : null}</span>
                <span className="text-ink/60">{money(r.amount)} · {dateVn(r.remitted_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
