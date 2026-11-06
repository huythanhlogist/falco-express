"use client";

import { useCallback, useEffect, useState } from "react";
import { officeApi, type KpiBucket, type KpiResponse, type OutreachResponse } from "@/lib/office-api";

type Range = "today" | "week";

// Mục tiêu tạm do hệ thống đặt (06/11) để có thước đo; chỉnh tại đây khi anh Huy chốt số khác.
const TARGET_SENT_PER_DAY = 30; // tin chào gửi mỗi ngày (bằng trần Zalo)
const TARGET_PASSED_PER_SALE = 6; // lead đạt mỗi sale mỗi ngày, 5 sale x 6 = 30 lead cho 30 tin
const TARGET_REPLY_RATE = 20; // % khách trả lời trên tin đã gửi

function Goal({ label, value, target, unit, note }: { label: string; value: number; target: number; unit?: string; note?: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((100 * value) / target)) : 0;
  const tone = pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <p className="text-[11px] font-bold text-slate-600">{pct}%</p>
      </div>
      <p className="text-xl font-extrabold text-navy-800">
        {value}
        {unit ?? ""} <span className="text-sm font-semibold text-slate-400">/ {target}{unit ?? ""}</span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {note ? <p className="mt-1 text-[11px] text-slate-400">{note}</p> : null}
    </div>
  );
}

const SALE_NOTE: Record<string, string> = {
  Linh: "Shop đặc sản",
  Nam: "Shop online Việt kiều",
  Vy: "Đại lý, cộng tác viên",
  Mai: "Tiệm và shop người Việt ở châu Âu",
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
  const [out, setOut] = useState<OutreachResponse | null>(null);

  const load = useCallback(async () => {
    const [r, o] = await Promise.all([officeApi<KpiResponse>("kpi"), officeApi<OutreachResponse>("outreach")]);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setData(r.data);
    if (o.ok) setOut(o.data);
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 text-base font-bold text-navy-800">So với mục tiêu ({label})</h3>
        <p className="mb-3 text-xs text-slate-500">
          Mục tiêu tạm: {TARGET_SENT_PER_DAY} tin gửi mỗi ngày, {TARGET_PASSED_PER_SALE} lead đạt mỗi sale mỗi ngày, {TARGET_REPLY_RATE}% khách trả lời. Chưa đo được tỷ lệ chốt đơn vì hệ thống chưa ghi nhận đơn hàng.
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Goal
            label="Lead đạt (cả phòng)"
            value={t?.passed ?? 0}
            target={TARGET_PASSED_PER_SALE * (data?.sales.length ?? 5) * (range === "week" ? Math.max(1, data?.sales[0]?.days.filter((d) => d.tasks > 0).length ?? 1) : 1)}
          />
          {range === "today" ? (
            <Goal label="Tin đã gửi hôm nay" value={out?.systems.zalo.sentToday ?? 0} target={TARGET_SENT_PER_DAY} note="Zalo; WhatsApp đang gửi rất ít" />
          ) : null}
          <Goal label="Tỷ lệ khách trả lời" value={out?.replyRate ?? 0} target={TARGET_REPLY_RATE} unit="%" note="tính trên mọi tin đã gửi" />
          {data?.sales.map((s) => (
            <Goal
              key={s.name}
              label={`${s.name}: lead đạt`}
              value={s[range].passed}
              target={TARGET_PASSED_PER_SALE * (range === "week" ? Math.max(1, s.days.filter((d) => d.tasks > 0).length) : 1)}
            />
          ))}
        </div>
      </section>

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
