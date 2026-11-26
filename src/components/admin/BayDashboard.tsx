"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BAY_SERVICE_CLASSES, BAY_SERVICE_LABELS, BAY_STATUS_LABELS } from "@/lib/bay-labels";
import BayCreateOrder from "@/components/admin/BayCreateOrder";
import { useToast } from "@/components/ui/Toast";
import type { BayMe, BayShipment, BayShipmentList, BayTracking } from "@/lib/bay-api";

type ApiError = { error: string; code?: string; requestId?: string | null };

async function bayGet<T>(path: string, query?: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const qs = query ? "?" + new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])) : "";
  const res = await fetch(`/api/admin/bay/${path}${qs}`, { signal });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (json ?? { error: `Lỗi HTTP ${res.status}` }) as ApiError;
    throw new Error(e.requestId ? `${e.error} (requestId ${e.requestId})` : e.error);
  }
  return json as T;
}

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
};

// Chỉ proxy ảnh thuộc origin https://img.bayonlinevn.com/<uuid> qua /api/admin/bay/img/<uuid>,
// tránh làm gãy ảnh từ domain ngoài tình cờ có UUID ở cuối URL.
const BAY_IMG_ORIGIN = "https://img.bayonlinevn.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const proxied = (u: string) => {
  try {
    const parsed = new URL(u);
    if (parsed.origin !== BAY_IMG_ORIGIN) return u;
    const id = parsed.pathname.replace(/^\/+|\/+$/g, "");
    return UUID_RE.test(id) ? `/api/admin/bay/img/${id.toLowerCase()}` : u;
  } catch {
    return u;
  }
};

function Images({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((u) => (
        <a key={u} href={proxied(u)} target="_blank" rel="noopener noreferrer" title="Mở ảnh gốc">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proxied(u)} alt="Ảnh vận đơn" loading="lazy" className="h-20 w-20 rounded-lg border border-line object-cover" />
        </a>
      ))}
    </div>
  );
}

function TrackingPanel({ reference, onClose }: { reference: string; onClose: () => void }) {
  const [data, setData] = useState<BayTracking | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    bayGet<BayTracking>(`shipments/${encodeURIComponent(reference)}/tracking`, undefined, controller.signal)
      .then((d) => setData(d))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [reference]);

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy-900">Hành trình {reference}</h2>
          {data && (
            <p className="mt-0.5 text-sm text-ink/60">
              {BAY_STATUS_LABELS[data.shipmentStatus] ?? data.shipmentStatus}
              {data.carrier.trackingNumber && ` · ${data.carrier.code?.toUpperCase() ?? "Hãng"} ${data.carrier.trackingNumber}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <a
              href={`/api/admin/bay/pdf?ref=${encodeURIComponent(reference)}`}
              download
              className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-mist/60"
              title="Tải file PDF hành trình kèm ảnh hàng về máy"
            >
              Tải PDF
            </a>
          )}
          <button type="button" onClick={onClose} className="text-sm text-ink/50 hover:text-ink/80">
            Đóng
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      {!data && !error && <p className="mt-3 text-sm text-ink/50">Đang tải…</p>}

      {data && (
        <>
          {data.receiveItems.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Kiện đã nhận tại kho</h3>
              <ul className="mt-2 space-y-2">
                {data.receiveItems.map((r) => (
                  <li key={r.code} className="text-sm">
                    <span className="font-medium">{r.code}</span> × {r.quantity} · {fmt(r.receivedAt)}
                    <Images urls={r.images} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ol className="mt-4 space-y-3 border-l-2 border-line pl-4">
            {data.events.map((e, i) => (
              <li key={i} className="relative">
                <span
                  className={`absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ${
                    e.source === "bay" ? "bg-navy-800" : "bg-emerald-500"
                  }`}
                />
                <p className="text-sm font-medium text-navy-900">
                  {e.description ?? e.code}
                  <span className="ml-2 text-xs font-normal text-ink/45">
                    {e.source === "bay" ? "Bay" : "Hãng vận chuyển"}
                  </span>
                </p>
                <p className="text-xs text-ink/55">
                  {fmt(e.occurredAt)}
                  {e.location && ` · ${e.location}${e.countryCode ? `, ${e.countryCode}` : ""}`}
                  {e.notes && ` · ${e.notes}`}
                  {e.packageCode && ` · kiện ${e.packageCode}`}
                </p>
                <Images urls={e.images} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

export default function BayDashboard({ configured }: { configured: boolean }) {
  const toast = useToast();
  const [me, setMe] = useState<BayMe | null>(null);
  const [list, setList] = useState<BayShipmentList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [ref, setRef] = useState("");
  const [debouncedRef, setDebouncedRef] = useState("");
  const [service, setService] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [febCodes, setFebCodes] = useState<Record<string, string>>({});
  const [syncMsg, setSyncMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const loadAbortRef = useRef<AbortController | null>(null);

  // Debounce 350ms cho ô tìm kiếm mã tham chiếu để tránh spam Bay API (hạn mức 60 req/phút).
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRef(ref), 350);
    return () => clearTimeout(timer);
  }, [ref]);

  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const q: Record<string, string | number> = { page, limit: 20 };
      if (status) q.status = status;
      if (debouncedRef.trim()) q.partnerReference = debouncedRef.trim();
      const data = await bayGet<BayShipmentList>("shipments", q, controller.signal);
      if (controller.signal.aborted) return;
      setList(data);
      const refs = data.data.map((s) => s.reference).join(",");
      if (refs) {
        fetch(`/api/admin/bay/sync?refs=${encodeURIComponent(refs)}`, { signal: controller.signal })
          .then((r) => (r.ok ? r.json() : {}))
          .then((codes) => {
            if (!controller.signal.aborted) setFebCodes(codes);
          })
          .catch(() => undefined);
      } else {
        setFebCodes({});
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page, status, debouncedRef]);

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
        ? `Đã tạo ${created.length} đơn mới: ${created.map((c: { reference: string; falcoCode: string }) => `${c.falcoCode} (${c.reference})`).join(", ")}. ${alreadySynced} đơn đã có từ trước.`
        : `Không có đơn mới — cả ${alreadySynced} vận đơn đã có mã FEB.`;
      setSyncMsg({ text });
      toast(created.length ? `Đã đồng bộ thêm ${created.length} đơn FEB` : "Tất cả vận đơn đã có mã FEB");
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
      .catch((e: Error) => setError(e.message));
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
          const text = `Đã tự tạo ${j.created.length} đơn mới: ${j.created.map((c: { falcoCode: string }) => c.falcoCode).join(", ")}.`;
          setSyncMsg({ text });
          toast(`Đã tự đồng bộ ${j.created.length} đơn FEB mới`);
          void load();
        }
      } catch {
        /* lỗi đồng bộ nền không chặn việc xem danh sách */
      }
    })();
    // chỉ chạy 1 lần khi mở trang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Chưa kết nối BayOnline. Tạo API key tại agency.bayonlinevn.com → API key (quyền{" "}
        <code>shipments:read</code>, <code>tracking:read</code>, <code>shipments:create</code>), rồi đặt vào biến môi
        trường <code>BAY_API_KEY</code> (file <code>.env.local</code> và Hostinger → Biến môi trường).
      </div>
    );
  }

  const filteredShipments = (list?.data ?? []).filter((s) => !service || s.serviceType === service);

  return (
    <div>
      {me && (
        <p className="text-sm text-ink/60">
          Key <span className="font-medium text-navy-900">{me.name}</span> ({me.keyPrefix}…) · quyền {me.scopes.join(", ")} ·
          giới hạn {me.rateLimit.perMinute}/phút, {me.rateLimit.perDay}/ngày
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
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
          onChange={(e) => setService(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
          aria-label="Lọc loại hàng"
          title="Lọc theo loại trong trang đang xem"
        >
          <option value="">Tất cả loại</option>
          {Object.entries(BAY_SERVICE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          value={ref}
          onChange={(e) => {
            setRef(e.target.value);
            setPage(1);
          }}
          placeholder="Mã tham chiếu của bạn"
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => void load()} className="btn-primary !px-4 !py-2 text-sm" disabled={loading}>
          {loading ? "Đang tải…" : "Làm mới"}
        </button>
        <button
          type="button"
          onClick={syncOrders}
          disabled={syncing}
          className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-mist/60 disabled:opacity-50"
          title="Tạo đơn Falco mã FEB… cho mọi vận đơn Bay chưa có mã, để khách tra cứu được trên web"
        >
          {syncing ? "Đang đồng bộ…" : "Đồng bộ mã đơn FEB"}
        </button>
        <BayCreateOrder onChanged={() => void load()} />
      </div>
      {syncMsg && (
        <p className={`mt-2 text-sm ${syncMsg.isError ? "text-rose-600" : "text-ink/70"}`}>{syncMsg.text}</p>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="px-3 py-2">Mã đơn Falco</th>
              <th className="px-3 py-2">Mã Bay</th>
              <th className="px-3 py-2">Mã của bạn</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Người nhận</th>
              <th className="px-3 py-2">Điểm đến</th>
              <th className="px-3 py-2">Cân (kg)</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Hãng · tracking</th>
              <th className="px-3 py-2">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {filteredShipments.map((s: BayShipment) => (
              <tr
                key={s.reference}
                onClick={() => setOpen(s.reference)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-mist/40"
              >
                <td className="px-3 py-2 font-semibold text-navy-900">
                  {febCodes[s.reference] ?? <span className="font-normal text-ink/35">chưa đồng bộ</span>}
                </td>
                <td className="px-3 py-2 text-ink/70">{s.reference}</td>
                <td className="px-3 py-2 text-ink/70">{s.partnerReference ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${BAY_SERVICE_CLASSES[s.serviceType] ?? "bg-mist text-ink/60"}`}>
                    {BAY_SERVICE_LABELS[s.serviceType] ?? s.serviceType}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink/70">{s.recipient.name ?? "—"}</td>
                <td className="px-3 py-2 text-ink/70">
                  {[s.recipient.address.city, s.recipient.address.countryCode].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-3 py-2 text-ink/70">{s.parcel.weightKg.total ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                    {BAY_STATUS_LABELS[s.status] ?? s.status}
                    {s.onHold && " · giữ"}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink/70">
                  {s.carrier.trackingNumber ? `${s.carrier.code?.toUpperCase() ?? ""} ${s.carrier.trackingNumber}` : "—"}
                </td>
                <td className="px-3 py-2 text-ink/55">{fmt(s.updatedAt)}</td>
              </tr>
            ))}
            {list && filteredShipments.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-ink/45">
                  {list.data.length === 0
                    ? "Chưa có vận đơn nào."
                    : "Không có vận đơn thuộc loại hàng đã chọn ở trang này."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {list && list.pagination.totalPages > 1 && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
            Trước
          </button>
          <span>
            Trang {list.pagination.page}/{list.pagination.totalPages} · {list.pagination.total} vận đơn
          </span>
          <button
            type="button"
            disabled={page >= list.pagination.totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}

      {open && <TrackingPanel reference={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
