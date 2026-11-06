"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHANNEL_LABEL, fmtTime, officeApi, type OutreachCounts, type OutreachMessage, type OutreachResponse } from "@/lib/office-api";

type ResultFilter = "all" | "da_phan_hoi" | "da_gui" | "gui_loi";

const CHANNEL_STYLE: Record<string, { dot: string; chip: string }> = {
  zalo: { dot: "bg-sky-500", chip: "bg-sky-100 text-sky-800" },
  whatsapp: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800" },
  facebook: { dot: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-800" },
  email: { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800" },
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((100 * part) / whole) : 0;
}

function resultText(m: OutreachMessage): { text: string; tone: string; border: string } {
  if (m.status === "da_phan_hoi") return { text: "Khách đã trả lời", tone: "bg-emerald-100 text-emerald-800", border: "border-l-emerald-500" };
  if (m.status === "gui_loi") return { text: "Gửi không được", tone: "bg-red-100 text-red-700", border: "border-l-red-500" };
  return { text: "Đã gửi, chờ khách trả lời", tone: "bg-sky-100 text-sky-800", border: "border-l-sky-400" };
}

function Chip({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  const color = ok === null ? "bg-slate-300" : ok ? "bg-emerald-500" : "bg-red-500";
  return (
    <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <b className="text-navy-800">{label}</b>
      <span className="text-slate-500">{detail}</span>
    </span>
  );
}

function FunnelStep({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone: string }) {
  return (
    <div className={`flex-1 rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
      {sub ? <p className="mt-0.5 text-xs opacity-70">{sub}</p> : null}
    </div>
  );
}

function Bar({ replied, sent, failed }: OutreachCounts) {
  const total = Math.max(1, sent + failed);
  return (
    <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <span className="bg-emerald-500" style={{ width: `${(100 * replied) / total}%` }} />
      <span className="bg-sky-400" style={{ width: `${(100 * (sent - replied)) / total}%` }} />
      <span className="bg-red-400" style={{ width: `${(100 * failed) / total}%` }} />
    </span>
  );
}

export default function OfficeOutreachPanel() {
  const [data, setData] = useState<OutreachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState("all");
  const [result, setResult] = useState<ResultFilter>("all");
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
    return data.messages.filter((m) => (channel === "all" || m.channel === channel) && (result === "all" || m.status === result));
  }, [data, channel, result]);

  const maxDay = useMemo(() => Math.max(1, ...(data?.byDay.map((d) => d.sent + d.failed) ?? [1])), [data]);
  const f = data?.funnel;
  const target = data?.dailyTarget ?? 30;
  const todayPct = Math.min(100, pct((data?.today.sent ?? 0) + (data?.today.failed ?? 0), target));

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Không đọc được thống kê: {error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Chip
          ok={data?.systems.zalo.loggedIn ?? null}
          label="Zalo"
          detail={data ? `${data.systems.zalo.sentToday}/${data.systems.zalo.dailyLimit} tin hôm nay` : "đang tải"}
        />
        <Chip
          ok={data ? data.systems.whatsapp.status === "WORKING" : null}
          label="WhatsApp"
          detail={data ? (data.systems.whatsapp.status === "WORKING" ? "đang chạy" : `lỗi: ${data.systems.whatsapp.status}`) : "đang tải"}
        />
        <Chip ok={null} label="Facebook" detail="chưa kết nối" />
        <Chip ok label="Tự duyệt" detail="điểm từ 65 trở lên" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-navy-800 to-slate-700 p-5 text-white">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold opacity-80">Hôm nay</p>
            <p className="text-5xl font-extrabold">
              {data?.today.sent ?? 0}
              <span className="text-xl font-semibold opacity-70"> / {target} tin đã gửi</span>
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-2xl font-bold">{data?.today.replied ?? 0}</p>
            <p className="opacity-80">khách trả lời hôm nay</p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${todayPct}%` }} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-navy-800">Hành trình của lead</h3>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <FunnelStep label="Lead đã tìm" value={f?.leads ?? 0} sub={`${f?.rejected ?? 0} bị loại`} tone="border-slate-200 bg-white text-navy-800" />
          <FunnelStep label="Đang chờ duyệt" value={f?.pending ?? 0} sub={`${f?.approved ?? 0} đã duyệt, chờ gửi`} tone="border-amber-200 bg-amber-50 text-amber-900" />
          <FunnelStep label="Đã gửi tin" value={f?.sent ?? 0} sub={f?.failed ? `${f.failed} gửi lỗi` : "không có lỗi"} tone="border-sky-200 bg-sky-50 text-sky-900" />
          <FunnelStep
            label="Khách trả lời"
            value={f?.replied ?? 0}
            sub={`${pct(f?.replied ?? 0, f?.sent ?? 0)}% trên số đã gửi`}
            tone="border-emerald-200 bg-emerald-50 text-emerald-900"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {["zalo", "whatsapp", "facebook"].map((k) => {
          const c = data?.byChannel.find((x) => x.key === k) ?? { key: k, sent: 0, replied: 0, failed: 0 };
          const off = k === "facebook";
          return (
            <section key={k} className={`rounded-2xl border border-slate-200 bg-white p-4 ${off ? "opacity-60" : ""}`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-navy-800">
                  <span className={`h-3 w-3 rounded-full ${CHANNEL_STYLE[k]?.dot ?? "bg-slate-400"}`} />
                  {CHANNEL_LABEL[k] ?? k}
                </h3>
                {off ? <span className="text-xs text-slate-500">Chưa kết nối</span> : <span className="text-xs text-slate-500">{pct(c.replied, c.sent)}% trả lời</span>}
              </div>
              <div className="mb-2 flex gap-5 text-sm">
                <p><b className="text-2xl text-navy-800">{c.sent}</b> <span className="text-slate-500">đã gửi</span></p>
                <p><b className="text-2xl text-emerald-700">{c.replied}</b> <span className="text-slate-500">trả lời</span></p>
                {c.failed ? <p><b className="text-2xl text-red-600">{c.failed}</b> <span className="text-slate-500">lỗi</span></p> : null}
              </div>
              <Bar {...c} />
            </section>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-navy-800">7 ngày gần nhất</h3>
          <div className="flex h-40 items-end gap-2">
            {data?.byDay.map((d) => {
              const h = Math.max(4, (100 * (d.sent + d.failed)) / maxDay);
              return (
                <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs font-semibold text-navy-800">{d.sent + d.failed || ""}</span>
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${h}%` }}>
                    <div className="bg-emerald-500" style={{ height: `${pct(d.replied, d.sent + d.failed)}%` }} />
                    <div className="bg-sky-400" style={{ height: `${pct(d.sent - d.replied, d.sent + d.failed)}%` }} />
                    <div className="bg-red-400" style={{ height: `${pct(d.failed, d.sent + d.failed)}%` }} />
                  </div>
                  <span className="text-[11px] text-slate-500">{d.day.slice(8)}/{d.day.slice(5, 7)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Xanh lá: khách trả lời · Xanh dương: chờ trả lời · Đỏ: gửi lỗi</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-navy-800">Theo từng sale</h3>
          {data && data.bySale.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : null}
          <ul className="space-y-3">
            {data?.bySale.map((s) => (
              <li key={s.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <b className="text-navy-800">{s.key}</b>
                  <span className="text-slate-500">{s.sent} gửi · {s.replied} trả lời{s.failed ? ` · ${s.failed} lỗi` : ""}</span>
                </div>
                <Bar {...s} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="font-bold text-navy-800">Từng tin đã gửi ({shown.length})</h3>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ["all", "Tất cả"],
                ["da_phan_hoi", "Khách đã trả lời"],
                ["da_gui", "Chờ trả lời"],
                ["gui_loi", "Gửi lỗi"],
              ] as [ResultFilter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setResult(k)}
                className={`rounded-full px-3 py-1 font-semibold ${result === k ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {label}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-slate-200" />
            {["all", "zalo", "whatsapp"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setChannel(k)}
                className={`rounded-full px-3 py-1 font-semibold ${channel === k ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {k === "all" ? "Mọi kênh" : CHANNEL_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        {data && shown.length === 0 ? <p className="p-4 text-sm text-slate-500">Chưa có tin nào khớp bộ lọc.</p> : null}
        <ul className="space-y-2 p-3">
          {shown.map((m) => {
            const r = resultText(m);
            return (
              <li key={m.id} className={`rounded-xl border border-slate-200 border-l-4 bg-white px-4 py-3 text-sm ${r.border}`}>
                <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
                  <span>
                    <b className="text-navy-800">{m.company}</b>
                    <span className="ml-2 text-xs text-slate-400">
                      {m.saleAgent} · {m.score} điểm · {fmtTime(m.sentAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHANNEL_STYLE[m.channel]?.chip ?? "bg-slate-100 text-slate-600"}`}>
                      {CHANNEL_LABEL[m.channel] ?? m.channel}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.tone}`}>{r.text}</span>
                  </span>
                </button>
                {m.replyText && m.autoReply ? (
                  <p className="mt-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-600">
                    <b>Tin tự động của khách (không tính là trả lời, bot không phản hồi):</b> {m.replyText}
                  </p>
                ) : null}
                {m.replyText && !m.autoReply ? (
                  <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">
                    <b>Khách nói{m.repliedAt ? ` (${fmtTime(m.repliedAt)})` : ""}:</b> {m.replyText}
                  </p>
                ) : null}
                {m.status === "gui_loi" && m.note ? <p className="mt-1.5 text-xs text-red-600">{m.note}</p> : null}
                {open === m.id ? (
                  <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    <p><b>Tin đã gửi:</b> {m.draft}</p>
                    <p className="text-slate-500">Liên hệ: {m.contact}{m.phone ? ` · ${m.phone}` : ""}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
