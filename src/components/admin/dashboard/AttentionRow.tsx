"use client";

import OrderTrackingButton from "@/components/admin/OrderTrackingButton";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { DashboardAlertItem } from "@/lib/dashboard";

/** 1 dòng "Cần chú ý" kèm nút Ẩn. Ẩn xong cảnh báo chỉ hiện lại khi trạng thái tracking đổi. */
export default function AttentionRow({ item }: { item: DashboardAlertItem }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  async function call(undo: boolean) {
    const res = await fetch("/api/admin/dashboard/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: item.id, shipmentStatus: item.shipmentStatus, undo }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Lỗi ${res.status}`);
  }

  async function dismiss() {
    setBusy(true);
    try {
      await call(false);
      setHidden(true);
      toast(`Đã ẩn ${item.falcoCode} khỏi "Cần chú ý"`, "success");
      router.refresh();
    } catch (err) {
      toast(`Không ẩn được: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  if (hidden) return null;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 rounded-lg px-1 py-[9px] transition-colors hover:bg-[#f8f8f6]">
      <OrderTrackingButton falcoCode={item.falcoCode} className="min-w-0 text-left">
        <b className="block truncate text-[13px] font-semibold text-[#14181f] tabular-nums">{item.falcoCode}</b>
        <span className="block truncate text-xs text-[#4b5563]">
          {item.recipientName}
          {item.ctvName ? ` (FWD ${item.ctvName})` : ""} · {item.country} · {item.carrier}
        </span>
      </OrderTrackingButton>
      <div className="flex items-center gap-1.5">
        <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[11px] font-semibold text-[#ed1c24]">
          {item.badge}
        </span>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          title="Ẩn cảnh báo này (tự hiện lại khi trạng thái đơn thay đổi)"
          aria-label={`Ẩn cảnh báo ${item.falcoCode}`}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[#8b8d93] transition-colors hover:bg-[#ecece8] hover:text-[#14181f] disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
