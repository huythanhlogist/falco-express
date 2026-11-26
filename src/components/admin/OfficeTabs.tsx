"use client";

import { useEffect, useState } from "react";
import OfficeScene from "@/components/admin/OfficeScene";
import OfficeLeadsPanel from "@/components/admin/OfficeLeadsPanel";
import OfficeQueuePanel from "@/components/admin/OfficeQueuePanel";
import OfficeNotesPanel from "@/components/admin/OfficeNotesPanel";
import OfficeZaloPanel from "@/components/admin/OfficeZaloPanel";
import OfficeKnowledgePanel from "@/components/admin/OfficeKnowledgePanel";
import OfficeOutreachPanel from "@/components/admin/OfficeOutreachPanel";
import OfficeKpiPanel from "@/components/admin/OfficeKpiPanel";
import { fmtTime, officeApi, type KnowledgeResponse, type NotesResponse } from "@/lib/office-api";
import type { OfficeLive } from "@/lib/office-agents";

type Tab = "overview" | "leads" | "zalo" | "outreach" | "kpi" | "queue" | "knowledge" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "leads", label: "Lead chờ duyệt" },
  { id: "zalo", label: "Gửi Zalo" },
  { id: "outreach", label: "Thống kê gửi tin" },
  { id: "kpi", label: "KPI sale" },
  { id: "queue", label: "Giao việc & hàng đợi" },
  { id: "knowledge", label: "Kiến thức" },
  { id: "notes", label: "Ghi chú & lỗi" },
];

function tabFromHash(): Tab {
  const h = window.location.hash.replace("#", "") as Tab;
  return TABS.some((t) => t.id === h) ? h : "overview";
}

export default function OfficeTabs() {
  const [tab, setTab] = useState<Tab>("overview");
  const [badges, setBadges] = useState<Partial<Record<Tab, number>>>({});
  const [alerts, setAlerts] = useState<string[]>([]);
  const [staleSince, setStaleSince] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  function choose(next: Tab) {
    if (next === tab) return;
    setTab(next);
    window.history.pushState(null, "", `#${next}`);
  }

  // Số nhỏ trên tab: lead chờ duyệt, việc lỗi hoặc bị chặn + cảnh báo hệ thống.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const load = async () => {
      if (document.hidden) return;
      const [r, n, k] = await Promise.all([
        officeApi<OfficeLive>("status"),
        officeApi<NotesResponse>("notes"),
        officeApi<KnowledgeResponse>("knowledge?summary=1"),
      ]);
      if (cancelled) return;
      if (r.ok) {
        setAlerts(r.data.alerts ?? []);
        setStaleSince(r.data.stale ? (r.data.staleSince ?? "") : null);
      }
      setBadges((prev) => ({
        ...prev,
        ...(r.ok
          ? {
              leads: r.data.leads.cho_duyet,
              queue: r.data.queue.failed + r.data.queue.blocked + (r.data.alerts?.length ?? 0),
            }
          : {}),
        ...(n.ok ? { notes: n.data.counts.mo } : {}),
        ...(k.ok ? { knowledge: k.data.counts.de_xuat } : {}),
      }));
    };

    const schedule = () => {
      timer = window.setTimeout(async () => {
        await load();
        if (!cancelled) schedule();
      }, 30_000);
    };

    const onVisibility = () => {
      if (!document.hidden && !cancelled) void load();
    };

    void load().then(() => {
      if (!cancelled) schedule();
    });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="Văn phòng AI">
        {TABS.map((t) => {
          const n = badges[t.id] ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => choose(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                tab === t.id ? "bg-navy-800 text-white" : "text-navy-800 hover:bg-slate-100"
              }`}
            >
              {t.label}
              {n > 0 ? (
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] ${tab === t.id ? "bg-white/20" : "bg-red-100 text-red-700"}`}>
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {staleSince !== null ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Đang hiển thị trạng thái tạm từ lúc {fmtTime(staleSince) || "trước đó"} do n8n phản hồi chậm hoặc tạm gián đoạn.
        </p>
      ) : null}

      {alerts.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-red-800">
            Cảnh báo hệ thống ({alerts.length})
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs font-semibold text-red-700">
            {alerts.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "overview" ? <OfficeScene /> : null}
      {tab === "leads" ? <OfficeLeadsPanel /> : null}
      {tab === "zalo" ? <OfficeZaloPanel /> : null}
      {tab === "outreach" ? <OfficeOutreachPanel /> : null}
      {tab === "kpi" ? <OfficeKpiPanel /> : null}
      {tab === "queue" ? <OfficeQueuePanel /> : null}
      {tab === "knowledge" ? <OfficeKnowledgePanel /> : null}
      {tab === "notes" ? <OfficeNotesPanel /> : null}
    </div>
  );
}
