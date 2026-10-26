"use client";

import { useState } from "react";

type Detail = {
  code: string;
  status: string;
  service: string | null;
  recipient: { name: string | null; company: string | null; phone: string | null; email: string | null; address: string };
  parcel: {
    weightKg: { total?: number | null; regular: number | null; liquid: number | null; perishable: number | null; counterfeit: number | null; electronic: number | null };
    dimensionsCm: { length: number; width: number; height: number } | null;
    volumetricWeightKg: number | null;
  };
  items: { description: string; quantity: number; unit: string | null }[];
  carrier: { name: string; trackingNumber: string; trackingUrl: string | null };
  timeline: { time: string; location: string | null; title: string }[];
  photos: { label: string; time: string; url: string }[];
};

const WEIGHT_LABELS: [keyof Detail["parcel"]["weightKg"], string][] = [
  ["regular", "Hàng thường"],
  ["liquid", "Hàng lỏng"],
  ["perishable", "Hàng dễ hỏng"],
  ["counterfeit", "Hàng hiệu"],
  ["electronic", "Điện tử"],
];

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b border-line py-1.5 text-sm last:border-0">
      <span className="text-ink/55">{k}</span>
      <span className="text-right font-medium text-navy-900">{v}</span>
    </div>
  );
}

export default function OrderDetailButton({ orderId, code }: { orderId: number; code: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  async function show() {
    setOpen(true);
    if (data) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/ctv/orders/${orderId}/detail`);
      const json = await res.json();
      if (!res.ok) setError(json.error || "Không tải được chi tiết");
      else setData(json);
    } catch {
      setError("Không tải được chi tiết");
    } finally {
      setLoading(false);
    }
  }

  const w = data?.parcel.weightKg;
  return (
    <>
      <button type="button" onClick={show} className="text-xs font-semibold text-navy-800 underline">
        Chi tiết
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy-900">Kiện hàng {code}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-ink/50 hover:bg-mist" aria-label="Đóng">
                ✕
              </button>
            </div>
            {loading && <p className="mt-6 text-center text-sm text-ink/50">Đang tải…</p>}
            {error && <p className="mt-6 text-center text-sm text-flame-700">{error}</p>}
            {data && w && (
              <div className="mt-3 space-y-5">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Người nhận</h3>
                  <Row k="Họ tên" v={data.recipient.name} />
                  <Row k="Công ty" v={data.recipient.company} />
                  <Row k="Điện thoại" v={data.recipient.phone} />
                  <Row k="Email" v={data.recipient.email} />
                  <Row k="Địa chỉ" v={data.recipient.address} />
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Kiện hàng</h3>
                  <Row k="Trạng thái" v={data.status} />
                  <Row k="Dịch vụ" v={data.service} />
                  <Row k="Tổng cân nặng" v={w.total != null ? `${w.total} kg` : null} />
                  {WEIGHT_LABELS.map(([key, label]) => (w[key] ? <Row key={key} k={label} v={`${w[key]} kg`} /> : null))}
                  <Row k="Kích thước" v={data.parcel.dimensionsCm ? `${data.parcel.dimensionsCm.length} × ${data.parcel.dimensionsCm.width} × ${data.parcel.dimensionsCm.height} cm` : null} />
                  <Row k="Cân quy đổi" v={data.parcel.volumetricWeightKg != null ? `${data.parcel.volumetricWeightKg} kg` : null} />
                  <Row k="Đơn vị giao cuối" v={data.carrier.name} />
                  <Row k="Mã tracking chặng cuối" v={data.carrier.trackingNumber} />
                </section>
                {data.items.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Hàng hoá</h3>
                    {data.items.map((it, i) => (
                      <Row key={i} k={it.description} v={`${it.quantity}${it.unit ? ` ${it.unit}` : ""}`} />
                    ))}
                  </section>
                )}
                {data.photos.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Hình ảnh ({data.photos.length})</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {data.photos.map((p, i) => (
                        <button key={i} type="button" onClick={() => setZoom(p.url)} className="overflow-hidden rounded-xl border border-line text-left">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={p.label} loading="lazy" className="aspect-square w-full object-cover" />
                          <span className="block px-2 py-1 text-xs text-ink/60">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {data.timeline.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/45">Hành trình</h3>
                    <ol className="mt-2 space-y-2">
                      {data.timeline.map((t, i) => (
                        <li key={i} className="rounded-xl bg-mist/60 px-3 py-2 text-sm">
                          <span className="font-semibold text-navy-900">{t.title}</span>
                          <span className="block text-xs text-ink/55">
                            {t.time}
                            {t.location ? ` · ${t.location}` : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </>
  );
}
