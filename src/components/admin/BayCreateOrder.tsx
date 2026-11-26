"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useConfirm, useToast } from "@/components/ui/Toast";
import type { BayDraftOrderInput, BayWarehouse } from "@/lib/bay-api";
import { BAY_SERVICE_LABELS } from "@/lib/bay-labels";

type ParcelForm = {
  items: { description: string; quantity: string }[];
  weight: string;
  length: string;
  width: string;
  height: string;
  imagesWeighed: string;
  imagesChecked: string;
};

const INITIAL_FORM = {
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
};

const COUNTRY_SUGGESTIONS: [string, string][] = [
  ["DE", "Đức"],
  ["PL", "Ba Lan"],
  ["FR", "Pháp"],
  ["GB", "Anh"],
  ["CZ", "Séc"],
  ["SK", "Slovakia"],
  ["NL", "Hà Lan"],
  ["ES", "Tây Ban Nha"],
  ["IT", "Ý"],
  ["AT", "Áo"],
  ["BE", "Bỉ"],
  ["SE", "Thụy Điển"],
  ["DK", "Đan Mạch"],
  ["IE", "Ireland"],
  ["PT", "Bồ Đào Nha"],
  ["HU", "Hungary"],
  ["RO", "Romania"],
  ["CH", "Thụy Sĩ"],
  ["NO", "Na Uy"],
  ["FI", "Phần Lan"],
  ["US", "Mỹ"],
  ["CA", "Canada"],
  ["AU", "Úc"],
];

const emptyParcel = (): ParcelForm => ({
  items: [{ description: "", quantity: "1" }],
  weight: "",
  length: "",
  width: "",
  height: "",
  imagesWeighed: "",
  imagesChecked: "",
});

const inputCls =
  "w-full rounded-xl border border-[#e7e7e3] bg-white px-3 py-2 text-sm text-[#14181f] placeholder:text-[#9ca3af] focus:border-[#132440] focus:outline-none focus:ring-2 focus:ring-[#132440]/10";
const labelCls = "mb-1 block text-xs font-semibold text-[#52525b]";
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function isValidHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

class BayClientError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "BayClientError";
  }
}

async function bayPost<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`/api/admin/bay/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const details = Array.isArray(json?.details) ? ` — ${json.details.join("; ")}` : "";
    throw new BayClientError(`${json?.error ?? `Lỗi HTTP ${res.status}`}${details}`, res.status);
  }
  return json as T;
}

export default function BayCreateOrder({ onChanged }: { onChanged: () => void }) {
  const ask = useConfirm();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(INITIAL_FORM);
  const [parcels, setParcels] = useState<ParcelForm[]>([emptyParcel()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ reference: string } | null>(null);
  const [warehouses, setWarehouses] = useState<BayWarehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [warehousesError, setWarehousesError] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [confirmed, setConfirmed] = useState<string[] | null>(null);
  // Mỗi lần tạo đơn có 1 khoá idempotency: retry khi mạng/5xx lỗi không sinh đơn nháp trùng.
  // Khi lỗi validate 4xx từ Bay, reset khoá để nhân viên sửa form rồi gửi lại bình thường.
  const idemKey = useRef("");

  const loadWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    setWarehousesError("");
    try {
      const res = await fetch("/api/admin/bay/warehouses");
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = j?.error ?? `Không tải được danh sách kho (HTTP ${res.status})`;
        setWarehousesError(msg);
        toast(msg, "error");
        return;
      }
      const list = Array.isArray(j?.data) ? (j.data as BayWarehouse[]) : [];
      setWarehouses(list);
      setWarehouse((cur) => cur || list[0]?.code || "");
    } catch {
      const msg = "Không kết nối được tới BayOnline để tải danh sách kho";
      setWarehousesError(msg);
      toast(msg, "error");
    } finally {
      setWarehousesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!open || warehouses.length > 0) return;
    void loadWarehouses();
  }, [open, warehouses.length, loadWarehouses]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setParcel = (i: number, patch: Partial<ParcelForm>) =>
    setParcels((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function buildPayload(): BayDraftOrderInput | string {
    const name = f.name.trim();
    const phone = f.phone.trim();
    const email = f.email.trim();
    const line1 = f.line1.trim();
    const city = f.city.trim();
    const postalCode = f.postalCode.trim();
    const countryCode = f.countryCode.trim().toUpperCase();

    if (!name || !phone || !email || !line1 || !city || !postalCode || !/^[A-Z]{2}$/.test(countryCode)) {
      return "Cần đủ: tên, SĐT, email người nhận; địa chỉ (đường, thành phố, mã bưu điện) và mã nước 2 chữ cái (vd DE)";
    }

    const out: BayDraftOrderInput["parcels"] = [];
    for (const [i, p] of parcels.entries()) {
      const items = p.items
        .filter((x) => x.description.trim())
        .map((x) => ({ description: x.description.trim(), quantity: Number(x.quantity) }));
      if (!items.length || items.some((x) => !Number.isInteger(x.quantity) || x.quantity < 1)) {
        return `Kiện ${i + 1}: cần ít nhất 1 dòng hàng, số lượng là số nguyên ≥ 1`;
      }

      const imagesWeighed = lines(p.imagesWeighed);
      if (imagesWeighed.length === 0 || imagesWeighed.length > 10 || imagesWeighed.some((u) => !isValidHttpsUrl(u))) {
        return `Kiện ${i + 1}: cần 1–10 link ảnh cân hợp lệ (https://…), mỗi link một dòng`;
      }

      const imagesChecked = lines(p.imagesChecked);
      if (imagesChecked.length > 10 || imagesChecked.some((u) => !isValidHttpsUrl(u))) {
        return `Kiện ${i + 1}: ảnh kiểm hàng tối đa 10 link hợp lệ (https://…)`;
      }

      let weightKg: { regular: number } | undefined;
      if (p.weight.trim()) {
        const w = Number(p.weight);
        if (!Number.isFinite(w) || w <= 0) return `Kiện ${i + 1}: cân nặng khai báo phải lớn hơn 0`;
        weightKg = { regular: w };
      }

      const hasAnyDim = Boolean(p.length.trim() || p.width.trim() || p.height.trim());
      let dimensionsCm: { length: number; width: number; height: number } | undefined;
      if (hasAnyDim) {
        const l = Number(p.length);
        const w = Number(p.width);
        const h = Number(p.height);
        if (!p.length.trim() || !p.width.trim() || !p.height.trim() || !(l > 0) || !(w > 0) || !(h > 0)) {
          return `Kiện ${i + 1}: nếu nhập kích thước thì phải nhập đủ Dài, Rộng, Cao > 0`;
        }
        dimensionsCm = { length: l, width: w, height: h };
      }

      out.push({
        items,
        ...(weightKg ? { weightKg } : {}),
        ...(dimensionsCm ? { dimensionsCm } : {}),
        imagesWeighed,
        ...(imagesChecked.length ? { imagesChecked } : {}),
      });
    }

    const partnerReference = f.partnerReference.trim();
    const note = f.note.trim();
    const senderName = f.senderName.trim();
    const senderPhone = f.senderPhone.trim();
    const company = f.company.trim();
    const houseNumber = f.houseNumber.trim();

    return {
      ...(partnerReference ? { partnerReference } : {}),
      serviceType: f.serviceType as "air" | "sea" | "cold",
      ...(note ? { note } : {}),
      ...(senderName || senderPhone
        ? { sender: { name: senderName || undefined, phone: senderPhone || undefined } }
        : {}),
      recipient: {
        name,
        phone,
        email,
        ...(company ? { company } : {}),
        address: {
          line1,
          ...(houseNumber ? { houseNumber } : {}),
          city,
          postalCode,
          countryCode,
        },
      },
      parcels: out,
    };
  }

  async function createDraft() {
    setError("");
    const payload = buildPayload();
    if (typeof payload === "string") {
      setError(payload);
      toast(payload, "error");
      return;
    }
    if (!idemKey.current) idemKey.current = crypto.randomUUID();
    setBusy(true);
    try {
      const created = await bayPost<{ reference: string }>("draft-orders", payload, idemKey.current);
      setDraft(created);
      toast(`Đã tạo đơn nháp ${created.reference}`, "success");
      onChanged();
    } catch (e) {
      // Lỗi 4xx (validate input từ Bay): reset Idempotency-Key để sửa form gửi lại không bị kẹt 409/422.
      if (e instanceof BayClientError && e.status && e.status >= 400 && e.status < 500) {
        idemKey.current = "";
      }
      const msg = e instanceof Error ? e.message : "Tạo đơn nháp thất bại";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    if (!draft || !warehouse) return;
    if (
      !(await ask(
        `Xác nhận (book tem) đơn ${draft.reference} cho kho ${warehouse}? Sẽ sinh vận đơn thật bên BayOnline.`,
        { confirmLabel: "Xác nhận", danger: false }
      ))
    ) {
      return;
    }
    setError("");
    setBusy(true);
    try {
      const j = await bayPost<{ shipments: { reference: string }[] }>(
        `draft-orders/${encodeURIComponent(draft.reference)}/confirm`,
        { warehouseCode: warehouse }
      );
      const refs = Array.isArray(j.shipments) ? j.shipments.map((s) => s.reference) : [];
      setConfirmed(refs);
      toast(`Đã xác nhận đơn BayOnline (${refs.join(", ")})`, "success");
      // Đồng bộ ngay để vận đơn vừa sinh có mã FEB… và khách tra cứu được trên web.
      await fetch("/api/admin/bay/sync?force=1", { method: "POST" }).catch(() => undefined);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xác nhận đơn thất bại";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  const reset = useCallback(() => {
    setF(INITIAL_FORM);
    setDraft(null);
    setConfirmed(null);
    setError("");
    setParcels([emptyParcel()]);
    idemKey.current = "";
  }, []);

  const handleClose = useCallback(() => {
    if (busy) return;
    if (confirmed) reset();
    setOpen(false);
  }, [busy, confirmed, reset]);

  const modalTitle = confirmed
    ? "Đã xác nhận vận đơn BayOnline"
    : draft
      ? `Xác nhận đơn nháp ${draft.reference}`
      : "Tạo đơn nháp BayOnline";

  const modalSubtitle = confirmed
    ? "Vận đơn thật đã được tạo bên BayOnline và đồng bộ mã FEB."
    : draft
      ? "Bước 2/2 · Chọn kho tiếp nhận và xác nhận để book tem."
      : "Bước 1/2 · Chưa tạo vận đơn thật — chỉ sinh vận đơn khi xác nhận ở bước sau.";

  const modalFooter = draft ? (
    confirmed ? (
      <>
        <button type="button" onClick={reset} className="btn-outline !px-4 !py-2 text-sm">
          Tạo đơn khác
        </button>
        <button type="button" onClick={handleClose} className="btn-navy">
          Hoàn tất
        </button>
      </>
    ) : (
      <>
        <button type="button" onClick={reset} disabled={busy} className="mr-auto text-xs font-semibold text-[#52525b] underline hover:text-[#132440] disabled:opacity-50">
          Tạo đơn khác
        </button>
        <button type="button" onClick={handleClose} disabled={busy} className="btn-outline !px-4 !py-2 text-sm disabled:opacity-50">
          Đóng
        </button>
        <button
          type="button"
          onClick={() => void confirmDraft()}
          disabled={busy || !warehouse}
          className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Đang xác nhận…" : "Xác nhận (book tem)"}
        </button>
      </>
    )
  ) : (
    <>
      <button type="button" onClick={handleClose} disabled={busy} className="btn-outline !px-4 !py-2 text-sm disabled:opacity-50">
        Huỷ
      </button>
      <button
        type="button"
        onClick={() => void createDraft()}
        disabled={busy}
        className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50"
      >
        {busy ? "Đang tạo…" : "Tạo đơn nháp"}
      </button>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary !px-4 !py-2 text-sm whitespace-nowrap"
      >
        + Tạo đơn mới
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title={modalTitle}
        subtitle={modalSubtitle}
        size="xl"
        busy={busy}
        footer={modalFooter}
      >
        {draft ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl border border-[#ecece8] bg-[#fafaf8] p-4">
              <p className="text-[#14181f]">
                Đã tạo đơn nháp <b className="text-[#132440]">{draft.reference}</b>. Đơn nháp chưa phải vận đơn —
                chọn kho tiếp nhận rồi bấm xác nhận để book tem.
              </p>
            </div>

            {confirmed ? (
              <div className="rounded-2xl border border-emerald-200 bg-[#e8f6ee] p-4 text-emerald-900">
                <p className="font-semibold">Đã xác nhận thành công!</p>
                <p className="mt-1">
                  Vận đơn BayOnline: <b>{confirmed.join(", ")}</b> (chờ kho nhận hàng). Mã đơn FEB… sẽ hiển thị ở bảng
                  vận đơn ngay sau khi tải lại.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <label htmlFor="bay-warehouse-select" className={labelCls}>
                  Kho tiếp nhận *
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    id="bay-warehouse-select"
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                    disabled={warehousesLoading || warehouses.length === 0}
                    className={`${inputCls} min-w-[260px] flex-1 disabled:opacity-50`}
                  >
                    {warehouses.length === 0 ? (
                      <option value="">
                        {warehousesLoading ? "Đang tải danh sách kho…" : "Chưa tải được danh sách kho"}
                      </option>
                    ) : (
                      warehouses.map((w) => (
                        <option key={w.code} value={w.code}>
                          {w.code} — {w.address}
                        </option>
                      ))
                    )}
                  </select>
                  {warehouses.length === 0 && (
                    <button
                      type="button"
                      onClick={() => void loadWarehouses()}
                      disabled={warehousesLoading}
                      className="rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2 text-xs font-semibold text-[#132440] hover:bg-[#f5f5f3] disabled:opacity-50"
                    >
                      {warehousesLoading ? "Đang tải…" : "Thử tải lại kho"}
                    </button>
                  )}
                </div>
                {warehousesError && <p className="text-xs text-rose-600">{warehousesError}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-[#ecece8] bg-[#fafaf8]/70 p-3.5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#8b8d93]">
                Thông tin đơn &amp; người gửi
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Mã tham chiếu của bạn</label>
                  <input
                    className={inputCls}
                    value={f.partnerReference}
                    onChange={(e) => set("partnerReference", e.target.value)}
                    placeholder="vd FL261024001"
                  />
                </div>
                <div>
                  <label className={labelCls}>Loại hàng</label>
                  <select
                    className={inputCls}
                    value={f.serviceType}
                    onChange={(e) => set("serviceType", e.target.value)}
                  >
                    {Object.entries(BAY_SERVICE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ghi chú cho Bay</label>
                  <input className={inputCls} value={f.note} onChange={(e) => set("note", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Người gửi (tuỳ chọn)</label>
                  <input
                    className={inputCls}
                    value={f.senderName}
                    onChange={(e) => set("senderName", e.target.value)}
                    placeholder="Tên người gửi"
                  />
                </div>
                <div>
                  <label className={labelCls}>SĐT người gửi</label>
                  <input
                    className={inputCls}
                    value={f.senderPhone}
                    onChange={(e) => set("senderPhone", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#ecece8] bg-[#fafaf8]/70 p-3.5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#8b8d93]">
                Người nhận &amp; địa chỉ giao hàng
              </h3>
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
                  ] as const
                ).map(([k, t]) => (
                  <div key={k}>
                    <label className={labelCls}>{t}</label>
                    <input className={inputCls} value={f[k]} onChange={(e) => set(k, e.target.value)} />
                  </div>
                ))}
                <div>
                  <label className={labelCls}>Mã nước (2 chữ) *</label>
                  <input
                    list="bay-country-codes"
                    maxLength={2}
                    placeholder="vd DE, FR, US"
                    className={`${inputCls} uppercase`}
                    value={f.countryCode}
                    onChange={(e) => set("countryCode", e.target.value.toUpperCase())}
                  />
                  <datalist id="bay-country-codes">
                    {COUNTRY_SUGGESTIONS.map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} — {name}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#8b8d93]">
                  Kiện hàng ({parcels.length})
                </h3>
                {parcels.length < 20 && (
                  <button
                    type="button"
                    onClick={() => setParcels([...parcels, emptyParcel()])}
                    className="text-xs font-semibold text-[#132440] underline underline-offset-2 hover:text-[#f7941d]"
                  >
                    + Thêm kiện (mỗi kiện thành 1 vận đơn)
                  </button>
                )}
              </div>

              {parcels.map((p, i) => (
                <div key={i} className="rounded-2xl border border-[#ecece8] bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <b className="text-sm text-[#132440]">Kiện {i + 1}</b>
                    {parcels.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setParcels(parcels.filter((_, j) => j !== i))}
                        className="text-xs font-medium text-rose-600 hover:underline"
                      >
                        Xoá kiện
                      </button>
                    )}
                  </div>
                  {p.items.map((it, k) => (
                    <div key={k} className="mt-2 flex items-center gap-2">
                      <input
                        className={inputCls}
                        value={it.description}
                        placeholder="Mô tả hàng"
                        onChange={(e) =>
                          setParcel(i, {
                            items: p.items.map((x, j) => (j === k ? { ...x, description: e.target.value } : x)),
                          })
                        }
                      />
                      <input
                        className="w-24 shrink-0 rounded-xl border border-[#e7e7e3] bg-white px-3 py-2 text-sm text-[#14181f] focus:border-[#132440] focus:outline-none"
                        value={it.quantity}
                        inputMode="numeric"
                        aria-label="Số lượng"
                        onChange={(e) =>
                          setParcel(i, {
                            items: p.items.map((x, j) => (j === k ? { ...x, quantity: e.target.value } : x)),
                          })
                        }
                      />
                      {p.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setParcel(i, { items: p.items.filter((_, j) => j !== k) })}
                          className="shrink-0 text-xs font-medium text-rose-600 hover:underline"
                        >
                          Xoá
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setParcel(i, { items: [...p.items, { description: "", quantity: "1" }] })}
                    className="mt-1.5 text-xs font-semibold text-[#132440] underline underline-offset-2"
                  >
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
                        <label className={labelCls}>{t}</label>
                        <input
                          className={inputCls}
                          value={p[k]}
                          inputMode="decimal"
                          onChange={(e) => setParcel(i, { [k]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Link ảnh cân * (1–10 link https, mỗi link một dòng)</label>
                      <textarea
                        className={inputCls}
                        rows={2}
                        value={p.imagesWeighed}
                        onChange={(e) => setParcel(i, { imagesWeighed: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Link ảnh kiểm hàng (tuỳ chọn)</label>
                      <textarea
                        className={inputCls}
                        rows={2}
                        value={p.imagesChecked}
                        onChange={(e) => setParcel(i, { imagesChecked: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
