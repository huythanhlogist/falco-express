"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshIcon, SearchIcon } from "@/components/icons";
import BayCreateOrder from "@/components/admin/BayCreateOrder";
import BayTrackingDrawer from "@/components/admin/BayTrackingDrawer";
import { useToast } from "@/components/ui/Toast";
import { BAY_SERVICE_CLASSES, BAY_SERVICE_LABELS, BAY_STATUS_LABELS } from "@/lib/bay-labels";
import type { BayMe, BayShipment, BayShipmentList } from "@/lib/bay-api";

type ApiError = { error: string; code?: string; requestId?: string | null };

const PAGE_SIZE = 20;
const API_PAGE_LIMIT = 100;
const INITIAL_API_PAGES = 3; // Tối đa 300 vận đơn gần nhất khi mở trang (tiết kiệm hạn mức 60 req/phút của Bay).

async function bayGet<T>(
  path: string,
  query?: Record<string, string | number>,
  signal?: AbortSignal
): Promise<T> {
  const qs = query ? "?" + new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])) : "";
  const res = await fetch(`/api/admin/bay/${path}${qs}`, { signal });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (json ?? { error: `Lỗi HTTP ${res.status}` }) as ApiError;
    throw new Error(e.requestId ? `${e.error} (requestId ${e.requestId})` : e.error);
  }
  return json as T;
}

function formatFullTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function formatCompactDateParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  const date = d.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const time = d.toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date, time };
}

function normalizeSearchText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

function statusPillClass(status: string): string {
  if (status === "completed") return "bg-[#e8f6ee] text-[#15803d]";
  if (status === "cancelled") return "bg-[#fdecec] text-[#b91c1c]";
  if (status === "held_at_destination_warehouse") return "bg-amber-50 text-amber-800";
  if (["handed_to_carrier", "at_destination_warehouse", "customs_cleared"].includes(status)) {
    return "bg-[#eef4ff] text-[#2563eb]";
  }
  if (["in_flight", "to_airport"].includes(status)) return "bg-sky-50 text-sky-700";
  return "bg-[#f4f4f1] text-[#4b5563]";
}

async function fetchFebCodesForRefs(
  refs: string[],
  signal?: AbortSignal
): Promise<Record<string, string>> {
  if (!refs.length) return {};
  const merged: Record<string, string> = {};
  for (let i = 0; i < refs.length; i += 100) {
    const chunk = refs.slice(i, i + 100).join(",");
    const res = await fetch(`/api/admin/bay/sync?refs=${encodeURIComponent(chunk)}`, { signal });
    if (!res.ok) continue;
    const codes = (await res.json().catch(() => ({}))) as Record<string, string>;
    Object.assign(merged, codes);
  }
  return merged;
}

export default function BayDashboard({ configured }: { configured: boolean }) {
  const toast = useToast();
  const [me, setMe] = useState<BayMe | null>(null);
  const [shipments, setShipments] = useState<BayShipment[]>([]);
  const [totalOnBay, setTotalOnBay] = useState(0);
  const [loadedApiPages, setLoadedApiPages] = useState(0);
  const [totalApiPages, setTotalApiPages] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Bộ lọc & phân trang phía client (20 dòng/trang).
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const [page, setPage] = useState(1);

  const [openRef, setOpenRef] = useState<string | null>(null);
  const [febCodes, setFebCodes] = useState<Record<string, string>>({});
  const [syncMsg, setSyncMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const loadAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const first = await bayGet<BayShipmentList>(
        "shipments",
        { page: 1, limit: API_PAGE_LIMIT },
        controller.signal
      );
      if (controller.signal.aborted) return;

      const all: BayShipment[] = [...first.data];
      const maxInitial = Math.min(first.pagination.totalPages, INITIAL_API_PAGES);
      let loadedPages = first.pagination.totalPages > 0 ? 1 : 0;

      for (let p = 2; p <= maxInitial; p++) {
        const next = await bayGet<BayShipmentList>(
          "shipments",
          { page: p, limit: API_PAGE_LIMIT },
          controller.signal
        );
        if (controller.signal.aborted) return;
        all.push(...next.data);
        loadedPages = p;
      }

      // Khử trùng phòng trường hợp Bay đẩy thêm đơn giữa 2 lần gọi trang.
      const seen = new Set<string>();
      const unique = all.filter((item) => {
        if (seen.has(item.reference)) return false;
        seen.add(item.reference);
        return true;
      });

      setShipments(unique);
      setTotalOnBay(first.pagination.total);
      setTotalApiPages(first.pagination.totalPages);
      setLoadedApiPages(loadedPages);
      setHasLoaded(true);

      const refs = unique.map((s) => s.reference);
      if (refs.length > 0) {
        fetchFebCodesForRefs(refs, controller.signal)
          .then((codes) => {
            if (!controller.signal.aborted) setFebCodes(codes);
          })
          .catch(() => undefined);
      } else {
        setFebCodes({});
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const msg = (e as Error).message || "Không tải được danh sách vận đơn BayOnline";
      setError(msg);
      toast(msg, "error");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [toast]);

  async function loadMoreFromBay() {
    if (loadingMore || loadedApiPages >= totalApiPages) return;
    setLoadingMore(true);
    try {
      const nextPage = loadedApiPages + 1;
      const next = await bayGet<BayShipmentList>("shipments", { page: nextPage, limit: API_PAGE_LIMIT });
      setShipments((prev) => {
        const existing = new Set(prev.map((x) => x.reference));
        const added = next.data.filter((x) => !existing.has(x.reference));
        return [...prev, ...added];
      });
      setLoadedApiPages(nextPage);
      setTotalOnBay(next.pagination.total);
      setTotalApiPages(next.pagination.totalPages);
      const pageRefs = next.data.map((x) => x.reference);
      if (pageRefs.length > 0) {
        fetchFebCodesForRefs(pageRefs)
          .then((codes) => setFebCodes((prev) => ({ ...prev, ...codes })))
          .catch(() => undefined);
      }
      toast(`Đã tải thêm ${next.data.length} vận đơn cũ hơn`, "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Không tải thêm được vận đơn", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  async function syncOrders() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/bay/sync?force=1", { method: "POST" });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error ?? `Lỗi HTTP ${res.status}`);
      const created = Array.isArray(j?.created) ? j.created : [];
      const alreadySynced = Number(j?.alreadySynced ?? 0);
      const text = created.length
        ? `Đã tạo ${created.length} đơn mới: ${created
            .map((c: { reference: string; falcoCode: string }) => `${c.falcoCode} (${c.reference})`)
            .join(", ")}. ${alreadySynced} đơn đã có từ trước.`
        : `Không có đơn mới — cả ${alreadySynced} vận đơn đã có mã FEB.`;
      setSyncMsg({ text });
      toast(
        created.length ? `Đã đồng bộ thêm ${created.length} đơn FEB` : "Tất cả vận đơn đã có mã FEB",
        "success"
      );
      void load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Đồng bộ mã đơn FEB thất bại";
      setSyncMsg({ text: msg, isError: true });
      toast(msg, "error");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!configured) return;
    bayGet<BayMe>("me")
      .then(setMe)
      .catch(() => undefined);
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    void load();
    return () => {
      loadAbortRef.current?.abort();
    };
  }, [configured, load]);

  // Mở tab là tự đồng bộ 1 lần (server bỏ qua nếu vừa đồng bộ < 2 phút): vận đơn mới bên Bay có ngay mã FEB…
  useEffect(() => {
    if (!configured) return;
    void (async () => {
      try {
        const res = await fetch("/api/admin/bay/sync", { method: "POST" });
        const j = await res.json().catch(() => null);
        if (res.ok && j?.created?.length) {
          const text = `Đã tự tạo ${j.created.length} đơn mới: ${j.created
            .map((c: { falcoCode: string }) => c.falcoCode)
            .join(", ")}.`;
          setSyncMsg({ text });
          toast(`Đã tự đồng bộ ${j.created.length} đơn FEB mới`, "success");
          void load();
        }
      } catch {
        /* lỗi đồng bộ nền không chặn việc xem danh sách */
      }
    })();
    // chỉ chạy 1 lần khi mở trang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  // Tìm kiếm & lọc trạng thái / loại hàng hoàn toàn phía client.
  const filteredShipments = useMemo(() => {
    const q = normalizeSearchText(search);
    return shipments.filter((s) => {
      if (status && s.status !== status) return false;
      if (service && s.serviceType !== service) return false;
      if (!q) return true;
      const haystack = normalizeSearchText(
        [
          febCodes[s.reference] ?? "",
          s.reference,
          s.partnerReference ?? "",
          s.recipient.name ?? "",
          s.recipient.phone ?? "",
          s.recipient.address.city ?? "",
          s.recipient.address.countryCode ?? "",
          s.carrier.code ?? "",
          s.carrier.trackingNumber ?? "",
        ].join(" ")
      );
      return haystack.includes(q);
    });
  }, [shipments, febCodes, search, status, service]);

  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredShipments.slice(start, start + PAGE_SIZE);
  }, [filteredShipments, safePage]);

  const selectedShipment = useMemo(
    () => (openRef ? shipments.find((s) => s.reference === openRef) ?? null : null),
    [openRef, shipments]
  );

  const closeDrawer = useCallback(() => setOpenRef(null), []);
  const handleOrderChanged = useCallback(() => {
    void load();
  }, [load]);

  const hasActiveFilter = Boolean(search.trim() || status || service);

  if (!configured) {
    return (
      <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">Chưa kết nối tài khoản BayOnline.</p>
        <p className="mt-1 text-amber-900/80">
          Vui lòng liên hệ quản trị viên để cấu hình khóa kết nối BayOnline trước khi tra cứu và tạo vận đơn.
        </p>
      </div>
    );
  }

  const startIdx = filteredShipments.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, filteredShipments.length);

  return (
    <div className="space-y-4">
      {/* Khung bộ lọc & thao tác */}
      <section className="rounded-[22px] border border-[#ecece8] bg-white p-4 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Ô tìm kiếm phía client */}
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8d93]" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm mã FEB, mã Bay, tham chiếu, người nhận, tracking…"
              aria-label="Tìm kiếm vận đơn BayOnline"
              className="w-full rounded-xl border border-[#e7e7e3] bg-white py-2 pl-9 pr-3 text-sm text-[#14181f] placeholder:text-[#8b8d93] focus:border-[#132440] focus:outline-none focus:ring-2 focus:ring-[#132440]/10"
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[#e7e7e3] bg-white px-3 py-2 text-sm text-[#14181f] focus:border-[#132440] focus:outline-none"
            aria-label="Lọc trạng thái"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(BAY_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[#e7e7e3] bg-white px-3 py-2 text-sm text-[#14181f] focus:border-[#132440] focus:outline-none"
            aria-label="Lọc loại hàng"
          >
            <option value="">Tất cả loại hàng</option>
            {Object.entries(BAY_SERVICE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2 text-sm font-medium text-[#132440] hover:bg-[#f5f5f3] disabled:opacity-50"
            >
              <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Đang tải…" : "Làm mới"}</span>
            </button>
            <button
              type="button"
              onClick={() => void syncOrders()}
              disabled={syncing}
              className="rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2 text-sm font-medium text-[#132440] hover:bg-[#f5f5f3] disabled:opacity-50"
              title="Tạo đơn Falco mã FEB… cho mọi vận đơn Bay chưa có mã, để khách tra cứu được trên web"
            >
              {syncing ? "Đang đồng bộ…" : "Đồng bộ mã FEB"}
            </button>
            <BayCreateOrder onChanged={handleOrderChanged} />
          </div>
        </div>

        {/* Thanh trạng thái gọn: tổng đơn, trạng thái kết nối, thông báo đồng bộ */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f1f1ed] pt-3 text-xs text-[#6b7280]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular-nums">
              {loading && !hasLoaded
                ? "Đang tải vận đơn…"
                : hasActiveFilter
                  ? `Khớp ${filteredShipments.length.toLocaleString("vi-VN")} / ${shipments.length.toLocaleString("vi-VN")} vận đơn đã tải`
                  : `${shipments.length.toLocaleString("vi-VN")} vận đơn${
                      totalOnBay > shipments.length ? ` (trên tổng ${totalOnBay.toLocaleString("vi-VN")} ở Bay)` : ""
                    }`}
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setService("");
                  setPage(1);
                }}
                className="font-semibold text-[#132440] underline underline-offset-2 hover:text-[#f7941d]"
              >
                Xoá bộ lọc
              </button>
            )}
            <span className="hidden text-[#9b9da3] sm:inline">
              · Bấm vào dòng bất kỳ để mở ngăn kéo xem hành trình &amp; ảnh kho
            </span>
          </div>

          {me && (
            <span
              className="inline-flex items-center gap-1.5 text-[#6b7280]"
              title={`Kết nối: ${me.name} · giới hạn ${me.rateLimit.perMinute}/phút, ${me.rateLimit.perDay}/ngày`}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-[#16a34a]" aria-hidden="true" />
              <span>Đã kết nối BayOnline</span>
            </span>
          )}
        </div>

        {syncMsg && (
          <div
            className={`mt-3 flex items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs ${
              syncMsg.isError
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-[#e8f6ee] text-emerald-900"
            }`}
          >
            <span>{syncMsg.text}</span>
            <button
              type="button"
              onClick={() => setSyncMsg(null)}
              className="shrink-0 font-semibold underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              Ẩn
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="shrink-0 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              Thử lại
            </button>
          </div>
        )}
      </section>

      {/* Danh sách vận đơn */}
      <section className="overflow-hidden rounded-[22px] border border-[#ecece8] bg-white shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]">
        {/* Trạng thái đang tải lần đầu */}
        {loading && !hasLoaded ? (
          <div className="p-6">
            <p className="text-sm text-[#6b7280]">Đang tải danh sách vận đơn BayOnline…</p>
            <div className="mt-4 space-y-2.5">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} className="h-11 animate-pulse rounded-xl bg-[#f5f5f3]" />
              ))}
            </div>
          </div>
        ) : pageItems.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#52525b]">
              {shipments.length === 0
                ? "Chưa có vận đơn BayOnline nào."
                : "Không tìm thấy vận đơn nào khớp với bộ lọc hiện tại."}
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setService("");
                  setPage(1);
                }}
                className="mt-3 rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#132440] hover:bg-[#f5f5f3]"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Bảng desktop: 7 cột gom gọn, vừa khít 1280px không cuộn ngang */}
            <div className={`hidden md:block ${loading ? "opacity-60 transition-opacity" : ""}`}>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-[#ecece8] bg-[#fafaf8] text-left">
                    <th className="w-[19%] px-3.5 py-3">Mã đơn</th>
                    <th className="w-[11%] px-2.5 py-3">Loại</th>
                    <th className="w-[20%] px-2.5 py-3">Người nhận</th>
                    <th className="w-[8%] px-2 py-3 text-right">Cân (kg)</th>
                    <th className="w-[17%] px-2.5 py-3">Trạng thái</th>
                    <th className="w-[15%] px-2.5 py-3">Hãng · Tracking</th>
                    <th className="w-[10%] px-3 py-3 text-right">Cập nhật</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f1ed]">
                  {pageItems.map((s) => {
                    const isSelected = openRef === s.reference;
                    const feb = febCodes[s.reference];
                    const dest = [s.recipient.address.city, s.recipient.address.countryCode]
                      .filter(Boolean)
                      .join(", ");
                    const updated = formatCompactDateParts(s.updatedAt);
                    const carrierText = s.carrier.trackingNumber
                      ? `${s.carrier.code?.toUpperCase() ?? ""} ${s.carrier.trackingNumber}`.trim()
                      : "";

                    return (
                      <tr
                        key={s.reference}
                        onClick={() => setOpenRef(s.reference)}
                        aria-selected={isSelected}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#132440]/[0.06] hover:bg-[#132440]/[0.08]"
                            : "hover:bg-[#fafaf8]"
                        }`}
                      >
                        <td className="px-3.5 py-2.5 align-middle">
                          <div className="truncate font-semibold text-[#132440] tabular-nums">
                            {feb ?? <span className="font-normal text-[#9b9da3]">chưa đồng bộ</span>}
                          </div>
                          <div
                            className="mt-0.5 truncate text-[11.5px] text-[#6b7280] tabular-nums"
                            title={`Mã Bay: ${s.reference}${s.partnerReference ? ` · Tham chiếu: ${s.partnerReference}` : ""}`}
                          >
                            {s.reference}
                            {s.partnerReference ? ` · ${s.partnerReference}` : ""}
                          </div>
                        </td>

                        <td className="px-2.5 py-2.5 align-middle">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              BAY_SERVICE_CLASSES[s.serviceType] ?? "bg-[#f4f4f1] text-[#4b5563]"
                            }`}
                          >
                            {BAY_SERVICE_LABELS[s.serviceType] ?? s.serviceType}
                          </span>
                        </td>

                        <td className="px-2.5 py-2.5 align-middle">
                          <div
                            className="truncate font-medium text-[#14181f]"
                            title={s.recipient.name ?? undefined}
                          >
                            {s.recipient.name ?? "—"}
                          </div>
                          <div className="mt-0.5 truncate text-[11.5px] text-[#6b7280]" title={dest || undefined}>
                            {dest || "—"}
                          </div>
                        </td>

                        <td className="px-2 py-2.5 text-right align-middle font-medium text-[#14181f] tabular-nums">
                          {s.parcel.weightKg.total ?? "—"}
                        </td>

                        <td className="px-2.5 py-2.5 align-middle">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusPillClass(
                                s.status
                              )}`}
                              title={BAY_STATUS_LABELS[s.status] ?? s.status}
                            >
                              {BAY_STATUS_LABELS[s.status] ?? s.status}
                            </span>
                            {s.onHold && (
                              <span className="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                giữ
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-2.5 py-2.5 align-middle">
                          {carrierText ? (
                            <div
                              className="truncate text-xs font-medium text-[#374151] tabular-nums"
                              title={carrierText}
                            >
                              {carrierText}
                            </div>
                          ) : (
                            <span className="text-xs text-[#9b9da3]">—</span>
                          )}
                        </td>

                        <td
                          className="px-3 py-2.5 text-right align-middle tabular-nums"
                          title={formatFullTime(s.updatedAt)}
                        >
                          <div className="text-xs font-medium text-[#374151]">{updated.date}</div>
                          {updated.time && <div className="text-[11px] text-[#8b8d93]">{updated.time}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Danh sách thẻ cho mobile (< md) */}
            <div className={`divide-y divide-[#f1f1ed] md:hidden ${loading ? "opacity-60" : ""}`}>
              {pageItems.map((s) => {
                const isSelected = openRef === s.reference;
                const feb = febCodes[s.reference];
                const dest = [s.recipient.address.city, s.recipient.address.countryCode]
                  .filter(Boolean)
                  .join(", ");
                const carrierText = s.carrier.trackingNumber
                  ? `${s.carrier.code?.toUpperCase() ?? ""} ${s.carrier.trackingNumber}`.trim()
                  : "";

                return (
                  <button
                    key={s.reference}
                    type="button"
                    onClick={() => setOpenRef(s.reference)}
                    className={`block w-full px-4 py-3.5 text-left transition-colors ${
                      isSelected ? "bg-[#132440]/[0.06]" : "hover:bg-[#fafaf8]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#132440] tabular-nums">
                          {feb ?? <span className="font-normal text-[#9b9da3]">chưa đồng bộ</span>}
                        </p>
                        <p className="truncate text-xs text-[#6b7280] tabular-nums">
                          {s.reference}
                          {s.partnerReference ? ` · ${s.partnerReference}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusPillClass(
                          s.status
                        )}`}
                      >
                        {BAY_STATUS_LABELS[s.status] ?? s.status}
                        {s.onHold ? " · giữ" : ""}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#4b5563]">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          BAY_SERVICE_CLASSES[s.serviceType] ?? "bg-[#f4f4f1] text-[#4b5563]"
                        }`}
                      >
                        {BAY_SERVICE_LABELS[s.serviceType] ?? s.serviceType}
                      </span>
                      <span className="truncate font-medium text-[#14181f]">{s.recipient.name ?? "—"}</span>
                      {dest && <span>· {dest}</span>}
                      {s.parcel.weightKg.total != null && (
                        <span className="tabular-nums">· {s.parcel.weightKg.total} kg</span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-[#8b8d93] tabular-nums">
                      <span className="truncate">{carrierText || "Chưa có mã hãng"}</span>
                      <span className="shrink-0">{formatFullTime(s.updatedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Phân trang 20 dòng phía client + tải thêm nếu Bay còn nhiều trang cũ */}
            {(totalPages > 1 || loadedApiPages < totalApiPages) && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f1f1ed] bg-[#fafaf8]/60 px-4 py-3 text-xs text-[#52525b]">
                <span className="tabular-nums">
                  Hiển thị <b>{startIdx}–{endIdx}</b> / {filteredShipments.length.toLocaleString("vi-VN")} vận đơn
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {loadedApiPages < totalApiPages && (
                    <button
                      type="button"
                      onClick={() => void loadMoreFromBay()}
                      disabled={loadingMore}
                      className="rounded-xl border border-[#e7e7e3] bg-white px-3 py-1.5 font-semibold text-[#132440] hover:bg-[#f5f5f3] disabled:opacity-50"
                    >
                      {loadingMore
                        ? "Đang tải thêm…"
                        : `Tải thêm đơn cũ (${shipments.length}/${totalOnBay})`}
                    </button>
                  )}

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded-xl border border-[#e7e7e3] bg-white px-3 py-1.5 font-medium text-[#132440] hover:bg-[#f5f5f3] disabled:opacity-40"
                      >
                        Trước
                      </button>
                      <span className="px-2 font-medium tabular-nums">
                        Trang {safePage}/{totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="rounded-xl border border-[#e7e7e3] bg-white px-3 py-1.5 font-medium text-[#132440] hover:bg-[#f5f5f3] disabled:opacity-40"
                      >
                        Sau
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <BayTrackingDrawer
        reference={openRef}
        febCode={openRef ? febCodes[openRef] : undefined}
        shipment={selectedShipment}
        onClose={closeDrawer}
      />
    </div>
  );
}
