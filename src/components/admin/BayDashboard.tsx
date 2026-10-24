"use client";

import { useCallback, useEffect, useState } from "react";
import { BAY_SERVICE_CLASSES, BAY_SERVICE_LABELS, BAY_STATUS_LABELS } from "@/lib/bay-labels";
import BayCreateOrder from "@/components/admin/BayCreateOrder";
import type { BayMe, BayShipment, BayShipmentList, BayTracking } from "@/lib/bay-api";

type ApiError = { error: string; code?: string; requestId?: string | null };

async function bayGet<T>(path: string, query?: Record<string, string | number>): Promise<T> {
  const qs = query ? "?" + new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])) : "";
  const res = await fetch(`/api/admin/bay/${path}${qs}`);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (json ?? { error: `Lỗi HTTP ${res.status}` }) as ApiError;
    throw new Error(e.requestId ? `${e.error} (requestId ${e.requestId})` : e.error);
  }
  return json as T;
}

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";

// Ảnh hiển thị qua tên miền Falco (route /api/admin/bay/img/<uuid>), không lộ link Bay.
const UUID_AT_END = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
const proxied = (u: string) => {
  const m = u.match(UUID_AT_END);
  return m ? `/api/admin/bay/img/${m[1].toLowerCase()}` : u;
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
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveImages() {
    if (!data) return;
    const urls = [...data.receiveItems.flatMap((r) => r.images), ...data.events.flatMap((e) => e.images)];
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/admin/bay/save-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `Lỗi HTTP ${res.status}`);
      setSaveMsg(`Đã lưu ${j.saved} ảnh mới, ${j.exists} ảnh đã có từ trước${j.failed ? `, ${j.failed} ảnh lỗi` : ""}.`);
    } catch (e) {
      setSaveMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    bayGet<BayTracking>(`shipments/${encodeURIComponent(reference)}/tracking`)
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
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
            <button type="button" onClick={saveImages} disabled={saving} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-mist/60 disabled:opacity-50">
              {saving ? "Đang lưu…" : "Lưu ảnh về server"}
            </button>
          )}
          <button type="button" onClick={onClose} className="text-sm text-ink/50 hover:text-ink/80">
            Đóng
          </button>
        </div>
      </div>
      {saveMsg && <p className="mt-2 text-sm text-ink/70">{saveMsg}</p>}

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
  const [me, setMe] = useState<BayMe | null>(null);
  const [list, setList] = useState<BayShipmentList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [ref, setRef] = useState("");
  const [service, setService] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q: Record<string, string | number> = { page, limit: 20 };
      if (status) q.status = status;
      if (ref.trim()) q.partnerReference = ref.trim();
      setList(await bayGet<BayShipmentList>("shipments", q));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, status, ref]);

  useEffect(() => {
    if (!configured) return;
    bayGet<BayMe>("me")
      .then(setMe)
      .catch((e: Error) => setError(e.message));
  }, [configured]);

  useEffect(() => {
    if (configured) void load();
  }, [configured, load]);

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Chưa kết nối BayOnline. Tạo API key tại agency.bayonlinevn.com → API key (quyền{" "}
        <code>shipments:read</code>, <code>tracking:read</code>, <code>shipments:create</code>), rồi đặt vào biến môi
        trường <code>BAY_API_KEY</code> (file <code>.env.local</code> và Hostinger → Biến môi trường).
      </div>
    );
  }

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
        <BayCreateOrder onChanged={() => void load()} />
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
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
            {(list?.data ?? []).filter((s) => !service || s.serviceType === service).map((s: BayShipment) => (
              <tr
                key={s.reference}
                onClick={() => setOpen(s.reference)}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-mist/40"
              >
                <td className="px-3 py-2 font-semibold text-navy-900">{s.reference}</td>
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
            {list && list.data.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-ink/45">
                  Chưa có vận đơn nào.
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
