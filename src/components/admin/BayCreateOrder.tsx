"use client";

import { useEffect, useRef, useState } from "react";
import type { BayDraftOrderInput, BayWarehouse } from "@/lib/bay-api";

type ParcelForm = {
  items: { description: string; quantity: string }[];
  weight: string;
  length: string;
  width: string;
  height: string;
  imagesWeighed: string;
  imagesChecked: string;
};

const emptyParcel = (): ParcelForm => ({
  items: [{ description: "", quantity: "1" }],
  weight: "",
  length: "",
  width: "",
  height: "",
  imagesWeighed: "",
  imagesChecked: "",
});

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";
const label = "block text-xs font-semibold text-ink/55";
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

async function bayPost<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`/api/admin/bay/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const details = Array.isArray(json?.details) ? ` — ${json.details.join("; ")}` : "";
    throw new Error(`${json?.error ?? `Lỗi HTTP ${res.status}`}${details}`);
  }
  return json as T;
}

export default function BayCreateOrder({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    partnerReference: "",
    serviceType: "air",
    note: "",
    senderName: "",
    senderPhone: "",
    name: "",
    phone: "",
    email: "",
    company: "",
    line1: "",
    houseNumber: "",
    city: "",
    postalCode: "",
    countryCode: "DE",
  });
  const [parcels, setParcels] = useState<ParcelForm[]>([emptyParcel()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ reference: string } | null>(null);
  const [warehouses, setWarehouses] = useState<BayWarehouse[]>([]);
  const [warehouse, setWarehouse] = useState("");
  const [confirmed, setConfirmed] = useState<string[] | null>(null);
  // Mỗi lần mở form có 1 khoá idempotency: bấm "Tạo" 2 lần (hoặc mạng lỗi) không sinh đơn nháp trùng.
  const idemKey = useRef("");

  useEffect(() => {
    if (!open || warehouses.length) return;
    fetch("/api/admin/bay/warehouses")
      .then((r) => r.json())
      .then((j) => {
        setWarehouses(j.data ?? []);
        setWarehouse(j.data?.[0]?.code ?? "");
      })
      .catch(() => undefined);
  }, [open, warehouses.length]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setParcel = (i: number, patch: Partial<ParcelForm>) =>
    setParcels((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function buildPayload(): BayDraftOrderInput | string {
    if (!f.name || !f.phone || !f.email || !f.line1 || !f.city || !f.postalCode || f.countryCode.length !== 2) {
      return "Cần đủ: tên, SĐT, email người nhận; địa chỉ (đường, thành phố, mã bưu điện) và mã nước 2 chữ (vd DE)";
    }
    const out: BayDraftOrderInput["parcels"] = [];
    for (const [i, p] of parcels.entries()) {
      const items = p.items.filter((x) => x.description.trim()).map((x) => ({ description: x.description.trim(), quantity: Number(x.quantity) }));
      if (!items.length || items.some((x) => !(x.quantity > 0))) return `Kiện ${i + 1}: cần ít nhất 1 dòng hàng, số lượng > 0`;
      const imagesWeighed = lines(p.imagesWeighed);
      if (!imagesWeighed.length || imagesWeighed.some((u) => !u.startsWith("https://"))) {
        return `Kiện ${i + 1}: cần 1–10 link ảnh cân (https://…), mỗi link một dòng`;
      }
      const imagesChecked = lines(p.imagesChecked);
      out.push({
        items,
        ...(p.weight ? { weightKg: { regular: Number(p.weight) } } : {}),
        ...(p.length && p.width && p.height
          ? { dimensionsCm: { length: Number(p.length), width: Number(p.width), height: Number(p.height) } }
          : {}),
        imagesWeighed,
        ...(imagesChecked.length ? { imagesChecked } : {}),
      });
    }
    return {
      ...(f.partnerReference ? { partnerReference: f.partnerReference } : {}),
      serviceType: f.serviceType as "air" | "sea" | "cold",
      ...(f.note ? { note: f.note } : {}),
      ...(f.senderName || f.senderPhone ? { sender: { name: f.senderName || undefined, phone: f.senderPhone || undefined } } : {}),
      recipient: {
        name: f.name,
        phone: f.phone,
        email: f.email,
        ...(f.company ? { company: f.company } : {}),
        address: {
          line1: f.line1,
          ...(f.houseNumber ? { houseNumber: f.houseNumber } : {}),
          city: f.city,
          postalCode: f.postalCode,
          countryCode: f.countryCode.toUpperCase(),
        },
      },
      parcels: out,
    };
  }

  async function createDraft() {
    setError("");
    const payload = buildPayload();
    if (typeof payload === "string") return setError(payload);
    if (!idemKey.current) idemKey.current = crypto.randomUUID();
    setBusy(true);
    try {
      setDraft(await bayPost<{ reference: string }>("draft-orders", payload, idemKey.current));
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    if (!draft || !warehouse) return;
    if (!window.confirm(`Xác nhận (book tem) đơn ${draft.reference} cho kho ${warehouse}? Sẽ sinh vận đơn thật bên BayOnline.`)) return;
    setError("");
    setBusy(true);
    try {
      const j = await bayPost<{ shipments: { reference: string }[] }>(
        `draft-orders/${encodeURIComponent(draft.reference)}/confirm`,
        { warehouseCode: warehouse }
      );
      setConfirmed(j.shipments.map((s) => s.reference));
      // Đồng bộ ngay để vận đơn vừa sinh có mã FEB… và khách tra cứu được trên web.
      await fetch("/api/admin/bay/sync", { method: "POST" }).catch(() => undefined);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDraft(null);
    setConfirmed(null);
    setError("");
    setParcels([emptyParcel()]);
    idemKey.current = "";
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary !px-4 !py-2 text-sm">
        Tạo đơn mới
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-navy-900">Tạo đơn nháp BayOnline</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink/50 hover:text-ink/80">
          Đóng
        </button>
      </div>

      {draft ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>
            Đã tạo đơn nháp <b>{draft.reference}</b>. Đơn nháp chưa phải vận đơn — chọn kho rồi xác nhận để book tem.
          </p>
          {confirmed ? (
            <p className="text-emerald-700">
              Đã xác nhận. Vận đơn: <b>{confirmed.join(", ")}</b> (chờ kho nhận hàng). Mã đơn FEB… hiện ở bảng vận đơn sau khi làm mới.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2">
                {warehouses.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.code} — {w.address}
                  </option>
                ))}
              </select>
              <button type="button" onClick={confirmDraft} disabled={busy || !warehouse} className="btn-primary !px-4 !py-2">
                {busy ? "Đang xác nhận…" : "Xác nhận (book tem)"}
              </button>
            </div>
          )}
          <button type="button" onClick={reset} className="text-ink/60 underline">
            Tạo đơn khác
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label}>Mã tham chiếu của bạn</label>
              <input className={input} value={f.partnerReference} onChange={(e) => set("partnerReference", e.target.value)} placeholder="vd FL261024001" />
            </div>
            <div>
              <label className={label}>Loại hàng</label>
              <select className={input} value={f.serviceType} onChange={(e) => set("serviceType", e.target.value)}>
                <option value="air">Hàng khô</option>
                <option value="sea">Đường biển</option>
                <option value="cold">Đông lạnh</option>
              </select>
            </div>
            <div>
              <label className={label}>Ghi chú cho Bay</label>
              <input className={input} value={f.note} onChange={(e) => set("note", e.target.value)} />
            </div>
            <div>
              <label className={label}>Người gửi (tuỳ chọn)</label>
              <input className={input} value={f.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder="Tên" />
            </div>
            <div>
              <label className={label}>SĐT người gửi</label>
              <input className={input} value={f.senderPhone} onChange={(e) => set("senderPhone", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["name", "Tên người nhận *"],
                ["phone", "SĐT người nhận *"],
                ["email", "Email người nhận *"],
                ["company", "Công ty"],
                ["line1", "Đường / địa chỉ *"],
                ["houseNumber", "Số nhà"],
                ["city", "Thành phố *"],
                ["postalCode", "Mã bưu điện *"],
                ["countryCode", "Mã nước (2 chữ) *"],
              ] as const
            ).map(([k, t]) => (
              <div key={k}>
                <label className={label}>{t}</label>
                <input className={input} value={f[k]} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
          </div>

          {parcels.map((p, i) => (
            <div key={i} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between">
                <b className="text-sm">Kiện {i + 1}</b>
                {parcels.length > 1 && (
                  <button type="button" onClick={() => setParcels(parcels.filter((_, j) => j !== i))} className="text-xs text-rose-600">
                    Xoá kiện
                  </button>
                )}
              </div>
              {p.items.map((it, k) => (
                <div key={k} className="mt-2 grid grid-cols-[1fr_90px] gap-2">
                  <input className={input} value={it.description} placeholder="Mô tả hàng" onChange={(e) => setParcel(i, { items: p.items.map((x, j) => (j === k ? { ...x, description: e.target.value } : x)) })} />
                  <input className={input} value={it.quantity} inputMode="numeric" onChange={(e) => setParcel(i, { items: p.items.map((x, j) => (j === k ? { ...x, quantity: e.target.value } : x)) })} />
                </div>
              ))}
              <button type="button" onClick={() => setParcel(i, { items: [...p.items, { description: "", quantity: "1" }] })} className="mt-1 text-xs text-navy-800 underline">
                + Thêm dòng hàng
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["weight", "Cân khai (kg)"],
                    ["length", "Dài (cm)"],
                    ["width", "Rộng (cm)"],
                    ["height", "Cao (cm)"],
                  ] as const
                ).map(([k, t]) => (
                  <div key={k}>
                    <label className={label}>{t}</label>
                    <input className={input} value={p[k]} inputMode="decimal" onChange={(e) => setParcel(i, { [k]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className={label}>Link ảnh cân * (https, mỗi link một dòng)</label>
                  <textarea className={input} rows={2} value={p.imagesWeighed} onChange={(e) => setParcel(i, { imagesWeighed: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Link ảnh kiểm hàng (tuỳ chọn)</label>
                  <textarea className={input} rows={2} value={p.imagesChecked} onChange={(e) => setParcel(i, { imagesChecked: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
          {parcels.length < 20 && (
            <button type="button" onClick={() => setParcels([...parcels, emptyParcel()])} className="text-sm text-navy-800 underline">
              + Thêm kiện (mỗi kiện thành một vận đơn)
            </button>
          )}

          <div>
            <button type="button" onClick={createDraft} disabled={busy} className="btn-primary !px-4 !py-2 text-sm">
              {busy ? "Đang tạo…" : "Tạo đơn nháp"}
            </button>
            <span className="ml-3 text-xs text-ink/50">Chưa tạo vận đơn thật — chỉ khi bấm &quot;Xác nhận&quot; ở bước sau.</span>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
