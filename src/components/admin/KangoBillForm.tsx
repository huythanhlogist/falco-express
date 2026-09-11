"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@/components/icons";

const BRANCH_OPTIONS = [
  { value: "HCM", label: "TP. Hồ Chí Minh (HCM)" },
  { value: "HN", label: "Hà Nội (HN)" },
  { value: "DN", label: "Đà Nẵng (DN)" },
];
const PACKAGE_TYPE_OPTIONS = [
  { value: 0, label: "Carton" },
  { value: 1, label: "Pallet" },
  { value: 2, label: "Túi (Phong bì)" },
];
const INVOICE_UNIT_OPTIONS = [
  { value: 0, label: "Pcs" },
  { value: 1, label: "Bag" },
  { value: 2, label: "Box" },
  { value: 3, label: "Jar" },
];
const EXPORT_AS_OPTIONS = [
  { value: 0, label: "Gift (không giá trị thương mại)" },
  { value: 1, label: "Sample (hàng mẫu)" },
];

type PackageRow = {
  packageQuantity: string;
  packageType: number;
  packageLength: string;
  packageWidth: string;
  packageHeight: string;
  packageWeight: string;
};

type InvoiceRow = {
  invoiceGoodsDetails: string;
  invoiceQuantity: string;
  invoiceUnit: number;
  invoicePrice: string;
  invoiceTotalPrice: string;
};

type FormState = {
  receiverCompanyName: string;
  receiverContactName: string;
  receiverTelephone: string;
  receiverCountry: string;
  receiverStateName: string;
  receiverCity: string;
  receiverPostalCode: string;
  receiverAddress1: string;
  receiverAddress2: string;
  receiverAddress3: string;
  shipmentService: string;
  shipmentSignatureFlg: boolean;
  shipmentBranch: string;
  shipmentReferenceCode: string;
  shipmentGoodsName: string;
  shipmentValue: string;
  shipmentExportAs: number;
};

const EMPTY_PACKAGE: PackageRow = {
  packageQuantity: "1",
  packageType: 0,
  packageLength: "",
  packageWidth: "",
  packageHeight: "",
  packageWeight: "",
};

const EMPTY_INVOICE: InvoiceRow = {
  invoiceGoodsDetails: "",
  invoiceQuantity: "1",
  invoiceUnit: 0,
  invoicePrice: "",
  invoiceTotalPrice: "",
};

const EMPTY_FORM: FormState = {
  receiverCompanyName: "",
  receiverContactName: "",
  receiverTelephone: "",
  receiverCountry: "",
  receiverStateName: "",
  receiverCity: "",
  receiverPostalCode: "",
  receiverAddress1: "",
  receiverAddress2: "",
  receiverAddress3: "",
  shipmentService: "",
  shipmentSignatureFlg: true,
  shipmentBranch: "HCM",
  shipmentReferenceCode: "",
  shipmentGoodsName: "",
  shipmentValue: "",
  shipmentExportAs: 0,
};

type RecentReceiver = {
  receiverCompanyName: string;
  receiverContactName: string;
  receiverTelephone: string;
  receiverCountry: string;
  receiverStateName: string;
  receiverCity: string;
  receiverPostalCode: string;
  receiverAddress1: string;
  receiverAddress2: string | null;
  receiverAddress3: string | null;
};

export type KangoBillInitial = FormState & { id: number; packages: PackageRow[]; invoices: InvoiceRow[] };

export default function KangoBillForm({ initial }: { initial?: KangoBillInitial }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM);
  const [packages, setPackages] = useState<PackageRow[]>(initial?.packages ?? [{ ...EMPTY_PACKAGE }]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initial?.invoices ?? []);
  const [recentReceivers, setRecentReceivers] = useState<RecentReceiver[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/kango-bills/receivers")
      .then((res) => res.json())
      .then((json) => setRecentReceivers(json.receivers ?? []))
      .catch(() => {});
  }, []);

  function applyReceiver(r: RecentReceiver) {
    setForm((f) => ({
      ...f,
      receiverCompanyName: r.receiverCompanyName,
      receiverContactName: r.receiverContactName,
      receiverTelephone: r.receiverTelephone,
      receiverCountry: r.receiverCountry,
      receiverStateName: r.receiverStateName,
      receiverCity: r.receiverCity,
      receiverPostalCode: r.receiverPostalCode,
      receiverAddress1: r.receiverAddress1,
      receiverAddress2: r.receiverAddress2 ?? "",
      receiverAddress3: r.receiverAddress3 ?? "",
    }));
  }

  function updatePackage(i: number, patch: Partial<PackageRow>) {
    setPackages((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function updateInvoice(i: number, patch: Partial<InvoiceRow>) {
    setInvoices((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function submit() {
    setError("");
    if (
      !form.receiverCompanyName.trim() ||
      !form.receiverContactName.trim() ||
      !form.receiverTelephone.trim() ||
      !form.receiverCountry.trim() ||
      !form.receiverStateName.trim() ||
      !form.receiverCity.trim() ||
      !form.receiverPostalCode.trim() ||
      !form.receiverAddress1.trim() ||
      !form.shipmentService.trim() ||
      !form.shipmentGoodsName.trim()
    ) {
      setError("Vui lòng nhập đủ các trường bắt buộc (đánh dấu *)");
      return;
    }
    if (packages.length === 0 || packages.some((p) => !p.packageLength || !p.packageWidth || !p.packageHeight || !p.packageWeight)) {
      setError("Vui lòng nhập đủ kích thước/cân nặng cho mọi kiện hàng");
      return;
    }

    const payload = {
      receiverCompanyName: form.receiverCompanyName,
      receiverContactName: form.receiverContactName,
      receiverTelephone: form.receiverTelephone,
      receiverCountry: form.receiverCountry,
      receiverStateName: form.receiverStateName,
      receiverCity: form.receiverCity,
      receiverPostalCode: form.receiverPostalCode,
      receiverAddress1: form.receiverAddress1,
      receiverAddress2: form.receiverAddress2 || null,
      receiverAddress3: form.receiverAddress3 || null,
      shipmentService: form.shipmentService,
      shipmentSignatureFlg: form.shipmentSignatureFlg,
      shipmentBranch: form.shipmentBranch,
      shipmentReferenceCode: form.shipmentReferenceCode || null,
      shipmentGoodsName: form.shipmentGoodsName,
      shipmentValue: Number(form.shipmentValue) || 0,
      shipmentExportAs: form.shipmentExportAs,
      packages: packages.map((p) => ({
        packageQuantity: Number(p.packageQuantity) || 1,
        packageType: p.packageType,
        packageLength: Number(p.packageLength),
        packageWidth: Number(p.packageWidth),
        packageHeight: Number(p.packageHeight),
        packageWeight: Number(p.packageWeight),
      })),
      invoices: invoices
        .filter((i) => i.invoiceGoodsDetails.trim())
        .map((i) => ({
          invoiceGoodsDetails: i.invoiceGoodsDetails,
          invoiceQuantity: Number(i.invoiceQuantity) || 1,
          invoiceUnit: i.invoiceUnit,
          invoicePrice: Number(i.invoicePrice) || 0,
          invoiceTotalPrice: Number(i.invoiceTotalPrice) || 0,
        })),
    };

    setSaving(true);
    try {
      const res = initial
        ? await fetch(`/api/admin/kango-bills/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/kango-bills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Có lỗi xảy ra");
        return;
      }
      router.push(initial ? `/admin/kango-bills/${initial.id}` : `/admin/kango-bills/${json.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {recentReceivers.length > 0 && (
        <div className="rounded-xl border border-line bg-mist/50 p-3.5">
          <label className="text-xs font-semibold text-ink/60">Chọn người nhận cũ (điền nhanh)</label>
          <select
            defaultValue=""
            onChange={(e) => {
              const r = recentReceivers[Number(e.target.value)];
              if (r) applyReceiver(r);
            }}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
          >
            <option value="" disabled>
              — Chọn khách đã gửi trước đó —
            </option>
            {recentReceivers.map((r, i) => (
              <option key={r.receiverTelephone} value={i}>
                {r.receiverContactName} — {r.receiverTelephone} ({r.receiverCity}, {r.receiverCountry})
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="rounded-xl border border-line bg-white p-4">
        <p className="font-display text-sm font-bold text-navy-900">Thông tin người nhận</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tên công ty *" value={form.receiverCompanyName} onChange={(v) => setForm({ ...form, receiverCompanyName: v })} />
          <Field label="Tên người nhận *" value={form.receiverContactName} onChange={(v) => setForm({ ...form, receiverContactName: v })} />
          <Field label="Số điện thoại *" value={form.receiverTelephone} onChange={(v) => setForm({ ...form, receiverTelephone: v })} />
          <Field label="Quốc gia *" value={form.receiverCountry} onChange={(v) => setForm({ ...form, receiverCountry: v })} />
          <Field label="Bang/Khu vực *" value={form.receiverStateName} onChange={(v) => setForm({ ...form, receiverStateName: v })} />
          <Field label="Thành phố *" value={form.receiverCity} onChange={(v) => setForm({ ...form, receiverCity: v })} />
          <Field label="Mã bưu chính *" value={form.receiverPostalCode} onChange={(v) => setForm({ ...form, receiverPostalCode: v })} />
          <Field label="Địa chỉ 1 *" value={form.receiverAddress1} onChange={(v) => setForm({ ...form, receiverAddress1: v })} />
          <Field label="Địa chỉ 2" value={form.receiverAddress2} onChange={(v) => setForm({ ...form, receiverAddress2: v })} />
          <Field label="Địa chỉ 3" value={form.receiverAddress3} onChange={(v) => setForm({ ...form, receiverAddress3: v })} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-4">
        <p className="font-display text-sm font-bold text-navy-900">Thông tin shipment</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Dịch vụ (vd: AIR-AU) *"
            value={form.shipmentService}
            onChange={(v) => setForm({ ...form, shipmentService: v })}
          />
          <div>
            <label className="text-xs font-semibold text-ink/60">Chi nhánh tạo *</label>
            <select
              value={form.shipmentBranch}
              onChange={(e) => setForm({ ...form, shipmentBranch: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            >
              {BRANCH_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <Field label="Tên hàng hoá *" value={form.shipmentGoodsName} onChange={(v) => setForm({ ...form, shipmentGoodsName: v })} />
          <div>
            <label className="text-xs font-semibold text-ink/60">Giá trị kiện hàng (USD) *</label>
            <input
              type="number"
              value={form.shipmentValue}
              onChange={(e) => setForm({ ...form, shipmentValue: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">Lý do gửi hàng *</label>
            <select
              value={form.shipmentExportAs}
              onChange={(e) => setForm({ ...form, shipmentExportAs: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            >
              {EXPORT_AS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Mã theo dõi nội bộ (tuỳ chọn)"
            value={form.shipmentReferenceCode}
            onChange={(v) => setForm({ ...form, shipmentReferenceCode: v })}
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={form.shipmentSignatureFlg}
              onChange={(e) => setForm({ ...form, shipmentSignatureFlg: e.target.checked })}
              className="h-4 w-4 rounded border-line accent-navy-800"
            />
            Yêu cầu chữ ký người nhận
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-bold text-navy-900">Kiện hàng *</p>
          <button
            type="button"
            onClick={() => setPackages((prev) => [...prev, { ...EMPTY_PACKAGE }])}
            className="text-xs font-semibold text-navy-700 hover:underline"
          >
            + Thêm kiện
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {packages.map((p, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-6">
              <NumField label="SL" value={p.packageQuantity} onChange={(v) => updatePackage(i, { packageQuantity: v })} />
              <div>
                <label className="text-xs font-semibold text-ink/60">Loại</label>
                <select
                  value={p.packageType}
                  onChange={(e) => updatePackage(i, { packageType: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
                >
                  {PACKAGE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <NumField label="Dài (cm)" value={p.packageLength} onChange={(v) => updatePackage(i, { packageLength: v })} />
              <NumField label="Rộng (cm)" value={p.packageWidth} onChange={(v) => updatePackage(i, { packageWidth: v })} />
              <NumField label="Cao (cm)" value={p.packageHeight} onChange={(v) => updatePackage(i, { packageHeight: v })} />
              <div className="flex items-end gap-1">
                <NumField label="Cân (kg)" value={p.packageWeight} onChange={(v) => updatePackage(i, { packageWeight: v })} />
                {packages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPackages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink/40 hover:bg-flame-50 hover:text-flame-700"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-bold text-navy-900">Invoice (tuỳ chọn)</p>
          <button
            type="button"
            onClick={() => setInvoices((prev) => [...prev, { ...EMPTY_INVOICE }])}
            className="text-xs font-semibold text-navy-700 hover:underline"
          >
            + Thêm dòng invoice
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {invoices.map((inv, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-ink/60">Tên sản phẩm</label>
                <input
                  value={inv.invoiceGoodsDetails}
                  onChange={(e) => updateInvoice(i, { invoiceGoodsDetails: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
                />
              </div>
              <NumField label="SL" value={inv.invoiceQuantity} onChange={(v) => updateInvoice(i, { invoiceQuantity: v })} />
              <div>
                <label className="text-xs font-semibold text-ink/60">Đơn vị</label>
                <select
                  value={inv.invoiceUnit}
                  onChange={(e) => updateInvoice(i, { invoiceUnit: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
                >
                  {INVOICE_UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <NumField label="Đơn giá" value={inv.invoicePrice} onChange={(v) => updateInvoice(i, { invoicePrice: v })} />
              <div className="flex items-end gap-1">
                <NumField label="Tổng tiền" value={inv.invoiceTotalPrice} onChange={(v) => updateInvoice(i, { invoiceTotalPrice: v })} />
                <button
                  type="button"
                  onClick={() => setInvoices((prev) => prev.filter((_, idx) => idx !== i))}
                  className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink/40 hover:bg-flame-50 hover:text-flame-700"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {invoices.length === 0 && <p className="text-xs text-ink/45">Không bắt buộc — chỉ cần khi có yêu cầu khai invoice chi tiết.</p>}
        </div>
      </section>

      {error && <p className="text-sm font-medium text-flame-700">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={saving} className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50">
          {saving ? "Đang lưu..." : initial ? "Lưu thay đổi" : "Lưu bill (nháp)"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-outline !px-5 !py-2.5 text-sm">
          Huỷ
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/60">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={225}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
      />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/60">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
      />
    </div>
  );
}
