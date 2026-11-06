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
import { officeApi, type KnowledgeResponse, type NotesResponse } from "@/lib/office-api";
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

export default function OfficeTabs() {
  const [tab, setTab] = useState<Tab>("overview");
  const [badges, setBadges] = useState<Partial<Record<Tab, number>>>({});

  useEffect(() => {
    const h = window.location.hash.replace("#", "") as Tab;
    if (TABS.some((t) => t.id === h)) setTab(h);
  }, []);

  function choose(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  // Số nhỏ trên tab: lead chờ duyệt, việc lỗi hoặc bị chặn.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      const [r, n, k] = await Promise.all([
        officeApi<OfficeLive>("status"),
        officeApi<NotesResponse>("notes"),
        officeApi<KnowledgeResponse>("knowledge?summary=1"),
      ]);
      if (cancelled) return;
      setBadges((prev) => ({
        ...prev,
        ...(r.ok
          ? {
              leads: r.data.leads.cho_duyet,
              queue: r.data.queue.failed + r.data.queue.blocked + r.data.alerts.length,
            }
          : {}),
        ...(n.ok ? { notes: n.data.counts.mo } : {}),
        ...(k.ok ? { knowledge: k.data.counts.de_xuat } : {}),
      }));
    };
    void load();
    const id = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
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
