"use client";

import { useEffect, useState } from "react";
import OfficeScene from "@/components/admin/OfficeScene";
import OfficeLeadsPanel from "@/components/admin/OfficeLeadsPanel";
import OfficeQueuePanel from "@/components/admin/OfficeQueuePanel";
import OfficeNotesPanel from "@/components/admin/OfficeNotesPanel";
import OfficeZaloPanel from "@/components/admin/OfficeZaloPanel";
import { officeApi } from "@/lib/office-api";
import type { OfficeLive } from "@/lib/office-agents";

type Tab = "overview" | "leads" | "zalo" | "queue" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "leads", label: "Lead chờ duyệt" },
  { id: "zalo", label: "Gửi Zalo" },
  { id: "queue", label: "Giao việc & hàng đợi" },
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
      const r = await officeApi<OfficeLive>("status");
      if (cancelled || !r.ok) return;
      setBadges({
        leads: r.data.leads.cho_duyet,
        queue: r.data.queue.failed + r.data.queue.blocked + r.data.alerts.length,
      });
    };
    void load();
    const id = window.setInterval(load, 20000);
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
      {tab === "queue" ? <OfficeQueuePanel /> : null}
      {tab === "notes" ? <OfficeNotesPanel /> : null}
    </div>
  );
}
