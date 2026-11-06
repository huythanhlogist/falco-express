"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHANNEL_LABEL, fmtTime, officeApi, type OutreachCounts, type OutreachMessage, type OutreachResponse } from "@/lib/office-api";

const STATUS_STYLE: Record<string, string> = {
  da_gui: "bg-sky-100 text-sky-800",
  da_phan_hoi: "bg-emerald-100 text-emerald-800",
  gui_loi: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  da_gui: "Đã gửi, chưa phản hồi",
  da_phan_hoi: "Khách đã phản hồi",
  gui_loi: "Lỗi gửi",
};

type StatusFilter = "all" | "da_gui" | "da_phan_hoi" | "gui_loi";

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((100 * part) / whole)}%` : "0%";
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-navy-800">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function BreakdownTable({ title, rows, labelOf }: { title: string; rows: ({ key: string } & OutreachCounts)[]; labelOf?: (k: string) => string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <h3 className="border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-navy-800">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-4 py-1.5">Tên</th>
            <th className="px-2 py-1.5 text-right">Đã gửi</th>
            <th className="px-2 py-1.5 text-right">Phản hồi</th>
            <th className="px-2 py-1.5 text-right">Tỷ lệ</th>
            <th className="px-4 py-1.5 text-right">Lỗi</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-3 text-xs text-slate-400">Chưa có dữ liệu.</td>
            </tr>
          ) : null}
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-slate-100">
              <td className="px-4 py-1.5 font-semibold text-navy-800">{labelOf ? labelOf(r.key) : r.key}</td>
              <td className="px-2 py-1.5 text-right">{r.sent}</td>
              <td className="px-2 py-1.5 text-right">{r.replied}</td>
              <td className="px-2 py-1.5 text-right">{pct(r.replied, r.sent)}</td>
              <td className="px-4 py-1.5 text-right text-red-600">{r.failed || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function OfficeOutreachPanel() {
  const [data, setData] = useState<OutreachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await officeApi<OutreachResponse>("outreach");
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setData(r.data);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const shown = useMemo<OutreachMessage[]>(() => {
    if (!data) return [];
    return data.messages.filter((m) => (channel === "all" || m.channel === channel) && (status === "all" || m.status === status));
  }, [data, channel, status]);

  const maxDay = useMemo(() => Math.max(1, ...(data?.byDay.map((d) => d.sent + d.failed) ?? [1])), [data]);
  const channels = data?.byChannel.map((c) => c.key) ?? [];

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Không đọc được thống kê: {error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Hôm nay đã gửi" value={data?.today.sent ?? 0} hint={`${data?.today.replied ?? 0} khách phản hồi`} />
        <StatCard label="Tổng đã gửi" value={data?.total.sent ?? 0} />
        <StatCard label="Khách đã phản hồi" value={data?.total.replied ?? 0} hint={`Tỷ lệ ${data?.replyRate ?? 0}%`} />
        <StatCard label="Lỗi gửi" value={data?.total.failed ?? 0} />
        <StatCard label="Chờ gửi" value={(data?.approved ?? 0) + (data?.pending ?? 0)} hint={`${data?.approved ?? 0} đã duyệt, ${data?.pending ?? 0} chờ duyệt`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <BreakdownTable title="Theo công cụ gửi" rows={data?.byChannel ?? []} labelOf={(k) => CHANNEL_LABEL[k] ?? k} />
        <BreakdownTable title="Theo sale" rows={data?.bySale ?? []} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-navy-800">14 ngày gần nhất</h3>
        <ul className="space-y-1">
          {data?.byDay.map((d) => (
            <li key={d.day} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-slate-500">{d.day.slice(5).split("-").reverse().join("/")}</span>
              <span className="flex h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className="bg-sky-400" style={{ width: `${(100 * (d.sent - d.replied)) / maxDay}%` }} />
                <span className="bg-emerald-500" style={{ width: `${(100 * d.replied) / maxDay}%` }} />
                <span className="bg-red-400" style={{ width: `${(100 * d.failed) / maxDay}%` }} />
              </span>
              <span className="w-28 shrink-0 text-right text-slate-600">
                {d.sent} gửi · {d.replied} phản hồi{d.failed ? ` · ${d.failed} lỗi` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">Xanh dương: đã gửi chưa phản hồi · Xanh lá: khách phản hồi · Đỏ: lỗi gửi</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="font-bold text-navy-800">Từng tin đã gửi ({shown.length})</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1">
              <option value="all">Mọi công cụ</option>
              {channels.map((c) => (
                <option key={c} value={c}>{CHANNEL_LABEL[c] ?? c}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="rounded-lg border border-slate-200 px-2 py-1">
              <option value="all">Mọi kết quả</option>
              <option value="da_phan_hoi">Khách đã phản hồi</option>
              <option value="da_gui">Chưa phản hồi</option>
              <option value="gui_loi">Lỗi gửi</option>
            </select>
          </div>
        </div>
        {data && shown.length === 0 ? <p className="p-4 text-sm text-slate-500">Chưa có tin nào khớp bộ lọc.</p> : null}
        <ul className="divide-y divide-slate-100">
          {shown.map((m) => (
            <li key={m.id} className="px-4 py-3 text-sm">
              <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
                <span className="font-semibold text-navy-800">
                  {m.company}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {m.saleAgent} · {m.score} điểm · {fmtTime(m.sentAt)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{CHANNEL_LABEL[m.channel] ?? m.channel}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[m.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>
                </span>
              </button>
              {m.replyText ? (
                <p className="mt-1.5 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">
                  <b>Khách trả lời{m.repliedAt ? ` (${fmtTime(m.repliedAt)})` : ""}:</b> {m.replyText}
                </p>
              ) : null}
              {m.status === "gui_loi" && m.note ? <p className="mt-1.5 text-xs text-red-600">{m.note}</p> : null}
              {open === m.id ? (
                <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  <p><b>Tin đã gửi:</b> {m.draft}</p>
                  <p className="text-slate-500">Liên hệ: {m.contact}{m.phone ? ` · ${m.phone}` : ""}</p>
                  {m.note ? <p className="text-slate-500">Ghi chú gửi: {m.note}</p> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
