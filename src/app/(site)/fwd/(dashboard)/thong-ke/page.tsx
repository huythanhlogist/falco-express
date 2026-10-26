import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { getCtvStats, type StatsPeriod } from "@/lib/ctv-portal";

export const dynamic = "force-dynamic";

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "month", label: "Tháng" },
  { value: "quarter", label: "Quý" },
  { value: "year", label: "Năm" },
];
const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
const kg = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("vi-VN")} kg`;

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <span className="text-xs text-ink/40">{cur ? "Mới" : "—"}</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return <span className={`text-xs font-semibold ${pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{pct >= 0 ? "+" : ""}{pct}% so với kỳ trước</span>;
}

function Bars({ data }: { data: { month: string; weightKg: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.weightKg));
  return (
    <svg viewBox="0 0 480 160" className="w-full" role="img" aria-label="Sản lượng 12 tháng">
      {data.map((d, i) => {
        const h = (d.weightKg / max) * 110;
        const x = 8 + i * 39;
        return (
          <g key={d.month}>
            <rect x={x} y={125 - h} width={26} height={Math.max(h, 1)} rx={3} fill="#1e3a8a" opacity={d.weightKg ? 0.9 : 0.15} />
            {d.weightKg > 0 && <text x={x + 13} y={120 - h} textAnchor="middle" fontSize="9" fill="#475569">{Math.round(d.weightKg)}</text>}
            <text x={x + 13} y={145} textAnchor="middle" fontSize="9" fill="#64748b">{`T${Number(d.month.slice(5))}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default async function CtvStatsPage({ searchParams }: { searchParams: Promise<{ p?: string; ref?: string }> }) {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/fwd/login");
  const sp = await searchParams;
  const period: StatsPeriod = sp.p === "quarter" || sp.p === "year" ? sp.p : "month";
  const nowVn = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const ref = /^\d{4}(-\d{2})?$/.test(sp.ref ?? "") ? (sp.ref as string) : nowVn;
  const s = await getCtvStats(session.ctvId, period, ref);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Thống kê</h1>
          <p className="mt-1 text-sm text-ink/55">{s.label} · chỉ tính đơn đã được duyệt hoặc do Falco gán</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link key={p.value} href={`/fwd/thong-ke?p=${p.value}&ref=${ref}`} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${period === p.value ? "bg-navy-800 text-white" : "bg-white text-ink/60 hover:bg-line"}`}>
              {p.label}
            </Link>
          ))}
          <form className="flex gap-1">
            <input type="hidden" name="p" value={period} />
            <input name="ref" type={period === "year" ? "number" : "month"} defaultValue={period === "year" ? ref.slice(0, 4) : ref} className="rounded-lg border border-line bg-white px-2 py-1 text-sm" />
            <button className="btn-outline !px-3 !py-1 text-sm">Xem</button>
          </form>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[
          ["Số đơn", String(s.orders), <Delta key="a" cur={s.orders} prev={s.prev.orders} />],
          ["Sản lượng", kg(s.weightKg), <Delta key="b" cur={s.weightKg} prev={s.prev.weightKg} />],
          ["Tiền thu theo đơn", money(s.revenue), <Delta key="c" cur={s.revenue} prev={s.prev.revenue} />],
        ].map(([label, value, delta]) => (
          <div key={label as string} className="rounded-xl border border-line bg-white p-4">
            <p className="text-xs text-ink/45">{label}</p>
            <p className="mt-1 font-display text-xl font-bold text-navy-900">{value}</p>
            <div className="mt-1">{delta}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold text-navy-900">Xu hướng sản lượng 12 tháng (kg)</h2>
        <Bars data={s.trend} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <h2 className="font-semibold text-navy-900">Theo khách hàng</h2>
          {s.byCustomer.length === 0 ? <p className="mt-3 text-sm text-ink/45">Chưa có đơn trong kỳ này.</p> : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {s.byCustomer.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate font-medium text-ink/80">{c.name}</span>
                  <span className="shrink-0 text-ink/55">{c.orders} đơn · {kg(c.weightKg)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <h2 className="font-semibold text-navy-900">Theo quốc gia</h2>
          {s.byCountry.length === 0 ? <p className="mt-3 text-sm text-ink/45">Chưa có đơn trong kỳ này.</p> : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {s.byCountry.map((c) => (
                <li key={c.country} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-medium text-ink/80">{c.country}</span>
                  <span className="text-ink/55">{c.orders} đơn · {kg(c.weightKg)}{s.weightKg ? ` · ${Math.round((c.weightKg / s.weightKg) * 100)}%` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
