"use client";

import OrderTrackingButton from "@/components/admin/OrderTrackingButton";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DashboardAlertItem } from "@/lib/dashboard";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // Tự làm mới mỗi 5 phút

type AlertsResponse = {
  count: number;
  items: DashboardAlertItem[];
  updatedAt?: number;
};

/**
 * Chuông cảnh báo đơn "Cần chú ý" (kẹt hải quan > 2 ngày, không cập nhật > 3 ngày,
 * giao thất bại / hoàn trả). Không nhận props để dễ gắn vào mọi vị trí trong khu quản trị.
 */
export default function AlertBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [items, setItems] = useState<DashboardAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const res = await fetch("/api/admin/dashboard/alerts", {
        cache: "no-store",
        signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as AlertsResponse;
      setCount(typeof data.count === "number" ? data.count : 0);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Không tải được cảnh báo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAlerts(controller.signal);

    const timer = window.setInterval(() => {
      void fetchAlerts();
    }, REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [fetchAlerts]);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Element | null;
      // Bấm trong cửa sổ tracking (Modal portal ra ngoài) thì không đóng chuông, nếu không cửa sổ sẽ mất theo.
      if (target?.closest?.('[role="dialog"]')) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const badgeLabel = count > 99 ? "99+" : String(count);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={count > 0 ? `Cảnh báo: ${count} đơn cần chú ý` : "Cảnh báo đơn hàng"}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e7e7e3] bg-white text-[#27272a] transition-colors hover:bg-[#f5f5f3]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-[#f5f5f3] bg-[#ed1c24] px-1 text-[10px] font-bold leading-none text-white tabular-nums">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-[#ecece8] bg-white shadow-lg sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-[#ecece8] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#14181f]">Đơn cần chú ý</span>
              {count > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#fdecec] px-2 py-0.5 text-xs font-semibold text-[#ed1c24] tabular-nums">
                  {count}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void fetchAlerts()}
              className="rounded-lg px-2 py-1 text-xs font-medium text-[#4b5563] transition-colors hover:bg-[#f5f5f3] hover:text-[#132440]"
            >
              Làm mới
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-[#ecece8]">
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-[#8b8d93]">
                Đang tải danh sách cảnh báo...
              </div>
            ) : error ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-[#ed1c24]">{error}</p>
                <button
                  type="button"
                  onClick={() => void fetchAlerts()}
                  className="mt-2 rounded-lg border border-[#ecece8] px-3 py-1 text-xs font-semibold text-[#132440] hover:bg-[#f5f5f3]"
                >
                  Thử lại
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-7 text-center">
                <span className="mx-auto mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f6ee] text-[#16a34a]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <p className="text-xs font-medium text-[#4b5563]">
                  Không có đơn nào cần xử lý gấp
                </p>
              </div>
            ) : (
              items.map((item) => (
                <OrderTrackingButton
                  key={item.id}
                  falcoCode={item.falcoCode}
                  className="block w-full px-4 py-3 text-left transition-colors hover:bg-[#f8f8f6]"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-[#14181f] tabular-nums">
                      {item.falcoCode}
                    </span>
                    <span className="shrink-0 rounded-full bg-[#fdecec] px-2 py-0.5 text-[11px] font-semibold text-[#ed1c24]">
                      {item.badge}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[#4b5563]">
                    {item.recipientName}
                    {item.ctvName ? ` (FWD ${item.ctvName})` : ""} · {item.country} · {item.carrier}
                  </span>
                </OrderTrackingButton>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#ecece8] bg-[#fafaf8] px-4 py-2.5 text-xs font-semibold">
            <Link
              href="/admin/tong-quan"
              onClick={() => setOpen(false)}
              className="text-[#4b5563] hover:text-[#132440]"
            >
              Xem Tổng quan
            </Link>
            <Link
              href="/admin/tong-quan/can-chu-y"
              onClick={() => setOpen(false)}
              className="text-[#132440] hover:underline"
            >
              Xem tất cả cảnh báo →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
