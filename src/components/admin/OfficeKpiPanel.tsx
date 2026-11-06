"use client";

import { useCallback, useEffect, useState } from "react";
import { officeApi, type KpiBucket, type KpiResponse } from "@/lib/office-api";

type Range = "today" | "week";

const SALE_NOTE: Record<string, string> = {
  Linh: "Shop đặc sản",
  Nam: "Shop online Việt kiều",
  Vy: "Đại lý, cộng tác viên",
  Mai: "Khách lẻ châu Âu",
  Khoa: "Linh kiện đi Mỹ",
};

function Metric({ label, value, sub, tone = "text-navy-800" }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`text-2xl font-extrabold ${tone}`}>{value}</p>
      {sub ? <p className="text-[11px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

function Spark({ days, pick }: { days: (KpiBucket & { day: string })[]; pick: (d: KpiBucket) => number }) {
  const max = Math.max(1, ...days.map(pick));
  return (
    <div className="flex h-12 items-end gap-1">
      {days.map((d) => (
        <div key={d.day} className="flex flex-1 flex-col items-center justify-end" title={`${d.day}: ${pick(d)}`}>
          <div className="w-full rounded-t bg-sky-400" style={{ height: `${Math.max(6, (100 * pick(d)) / max)}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function OfficeKpiPanel() {
  const [data, setData] = useState<KpiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("today");

  const load = useCallback(async () => {
    const r = await officeApi<KpiResponse>("kpi");
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setData(r.data);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const t = data?.totals[range];
  const label = range === "today" ? "Hôm nay" : "7 ngày gần nhất";

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Không đọc được KPI: {error}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy-800">KPI của phòng sale ({label})</h2>
          <p className="text-xs text-slate-500">
            Giờ làm việc tính từ lúc giao việc đến lúc báo xong. Nhật ký bắt đầu ghi từ{" "}
            {data?.logStartsAt ? new Date(data.logStartsAt).toLocaleDateString("vi-VN") : "hôm nay"}, nên các ngày trước đó chưa có số liệu.
          </p>
        </div>
        <div className="flex gap-1.5 text-xs">
          {(["today", "week"] as Range[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`rounded-full px-3 py-1.5 font-semibold ${range === k ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {k === "today" ? "Hôm nay" : "7 ngày"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric label="Giờ làm việc" value={`${t?.hours ?? 0}h`} sub={`${t?.avgMinutes ?? 0} phút mỗi việc`} />
        <Metric label="Việc xong" value={t?.done ?? 0} sub={t?.failed ? `${t.failed} lỗi` : "không lỗi"} tone="text-emerald-700" />
        <Metric label="Lead tìm được" value={t?.found ?? 0} sub={`${t?.passed ?? 0} qua kiểm tra`} />
        <Metric label="Tỷ lệ đạt" value={`${t?.passRate ?? 0}%`} sub="lead đạt trên lead tìm" tone="text-sky-700" />
        <Metric label="Đã gửi tin" value={t?.sent ?? 0} sub={`${t?.approved ?? 0} đã duyệt`} />
        <Metric label="Khách trả lời" value={t?.replied ?? 0} sub={`${t?.rejected ?? 0} lead bị loại`} tone="text-emerald-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data?.sales.map((s) => {
          const b = s[range];
          const busy = b.tasks > 0;
          return (
            <section key={s.name} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-navy-800">
                    {s.name} <span className="text-xs font-normal text-slate-400">{s.code} · {SALE_NOTE[s.name]}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {busy ? `${b.search} lượt tìm lead · ${b.strategy} việc cố vấn · ${b.learn} việc học` : "Chưa có việc nào xong trong khoảng này"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${b.passed > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                  {b.passed} lead đạt
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Giờ làm" value={`${b.hours}h`} sub={`${b.avgMinutes} phút/việc`} />
                <Metric label="Việc xong" value={b.done} sub={b.failed ? `${b.failed} lỗi` : undefined} />
                <Metric label="Lead tìm/đạt" value={`${b.found}/${b.passed}`} sub={`${b.passRate}% đạt`} />
                <Metric label="Đã duyệt" value={b.approved} />
                <Metric label="Đã gửi" value={b.sent} />
                <Metric label="Trả lời" value={b.replied} tone="text-emerald-700" />
              </div>
              <div className="mt-3">
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Việc xong mỗi ngày (7 ngày)</p>
                <Spark days={s.days} pick={(d) => d.done} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
