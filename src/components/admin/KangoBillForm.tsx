"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon, TrashIcon } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import {
  ALLOWED_KANGO_IMAGE_TYPES,
  MAX_CUSTOMER_NOTE_LENGTH,
  MAX_KANGO_BILL_IMAGES,
  MAX_KANGO_IMAGE_BYTES,
} from "@/lib/kango-bill-validate";

const BRANCH_OPTIONS = [
  { value: "HCM", label: "TP. Hồ Chí Minh (HCM)" },
  { value: "HN", label: "Hà Nội (HN)" },
  { value: "DN", label: "Đà Nẵng (DN)" },
  { value: "NGHE-AN", label: "Nghệ An (NGHE-AN)" },
  { value: "DQH - HCM", label: "DQH - TP. Hồ Chí Minh" },
  { value: "QUẢNG TRỊ", label: "Quảng Trị" },
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
  customerNote: string;
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
  customerNote: "",
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

function formatCalcTotal(qtyRaw: string, priceRaw: string): string {
  if (!qtyRaw.trim() || !priceRaw.trim()) return "";
  const qty = Number(qtyRaw);
  const price = Number(priceRaw);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty < 0 || price < 0) return "";
  return String(Math.round(qty * price * 100) / 100);
}

export default function KangoBillForm({ initial }: { initial?: KangoBillInitial }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM);
  const [packages, setPackages] = useState<PackageRow[]>(initial?.packages ?? [{ ...EMPTY_PACKAGE }]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initial?.invoices ?? []);
  const [recentReceivers, setRecentReceivers] = useState<RecentReceiver[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/kango-bills/receivers")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (Array.isArray(json?.receivers)) setRecentReceivers(json.receivers);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setImagePreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageFiles]);

  function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    setImageError("");
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;

    if (imageFiles.length + picked.length > MAX_KANGO_BILL_IMAGES) {
      const msg = `Tối đa ${MAX_KANGO_BILL_IMAGES} ảnh mỗi bill (đã chọn ${imageFiles.length} ảnh)`;
      setImageError(msg);
      toast(msg, "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    for (const file of picked) {
      if (!ALLOWED_KANGO_IMAGE_TYPES.has(file.type)) {
        const msg = `"${file.name}" không đúng định dạng (chỉ nhận JPEG, PNG, WebP)`;
        setImageError(msg);
        toast(msg, "error");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size === 0) {
        const msg = `Ảnh "${file.name}" không có dữ liệu`;
        setImageError(msg);
        toast(msg, "error");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_KANGO_IMAGE_BYTES) {
        const msg = `Ảnh "${file.name}" vượt quá 5 MB`;
        setImageError(msg);
        toast(msg, "error");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setImageFiles((prev) => [...prev, ...picked]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
    setInvoices((prev) =>
      prev.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, ...patch };
        // Tự tính Tổng tiền = SL × Đơn giá khi nhân viên thay đổi SL hoặc Đơn giá (vẫn cho sửa tay nếu cần).
        if (
          ("invoiceQuantity" in patch || "invoicePrice" in patch) &&
          !("invoiceTotalPrice" in patch)
        ) {
          const calc = formatCalcTotal(next.invoiceQuantity, next.invoicePrice);
          if (calc) next.invoiceTotalPrice = calc;
        }
        return next;
      })
    );
  }

  const filledInvoices = invoices.filter((i) => i.invoiceGoodsDetails.trim());
  const invoiceSum = filledInvoices.reduce((acc, i) => {
    const t = Number(i.invoiceTotalPrice);
    return acc + (Number.isFinite(t) ? t : 0);
  }, 0);
  const shipmentValueNum = Number(form.shipmentValue);
  const invoiceMismatch =
    filledInvoices.length > 0 &&
    form.shipmentValue.trim() !== "" &&
    Number.isFinite(shipmentValueNum) &&
    Math.abs(invoiceSum - shipmentValueNum) > 0.01;

  function failValidation(msg: string) {
    setError(msg);
    toast(msg, "error");
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
      failValidation("Vui lòng nhập đủ các trường bắt buộc (đánh dấu *)");
      return;
    }

    const parsedShipmentValue = form.shipmentValue.trim() ? Number(form.shipmentValue) : NaN;
    if (!Number.isFinite(parsedShipmentValue) || parsedShipmentValue <= 0) {
      failValidation("Giá trị kiện hàng (USD) bắt buộc và phải lớn hơn 0");
      return;
    }

    if (packages.length === 0) {
      failValidation("Vui lòng thêm ít nhất 1 kiện hàng");
      return;
    }
    for (let idx = 0; idx < packages.length; idx++) {
      const p = packages[idx];
      const qty = p.packageQuantity.trim() ? Number(p.packageQuantity) : NaN;
      const len = p.packageLength.trim() ? Number(p.packageLength) : NaN;
      const wid = p.packageWidth.trim() ? Number(p.packageWidth) : NaN;
      const hei = p.packageHeight.trim() ? Number(p.packageHeight) : NaN;
      const wgt = p.packageWeight.trim() ? Number(p.packageWeight) : NaN;
      if (!Number.isInteger(qty) || qty < 1) {
        failValidation(`Kiện ${idx + 1}: số lượng (SL) phải là số nguyên ≥ 1`);
        return;
      }
      if (
        !Number.isFinite(len) ||
        len <= 0 ||
        !Number.isFinite(wid) ||
        wid <= 0 ||
        !Number.isFinite(hei) ||
        hei <= 0 ||
        !Number.isFinite(wgt) ||
        wgt <= 0
      ) {
        failValidation(`Kiện ${idx + 1}: kích thước (Dài, Rộng, Cao) và Cân nặng phải lớn hơn 0`);
        return;
      }
    }

    const normalizedInvoices = [];
    for (let idx = 0; idx < filledInvoices.length; idx++) {
      const inv = filledInvoices[idx];
      const qty = inv.invoiceQuantity.trim() ? Number(inv.invoiceQuantity) : NaN;
      const price = inv.invoicePrice.trim() ? Number(inv.invoicePrice) : NaN;
      const totalRaw = inv.invoiceTotalPrice.trim()
        ? inv.invoiceTotalPrice
        : formatCalcTotal(inv.invoiceQuantity, inv.invoicePrice);
      const total = totalRaw ? Number(totalRaw) : NaN;
      if (!Number.isInteger(qty) || qty < 1) {
        failValidation(`Invoice dòng ${idx + 1}: số lượng phải là số nguyên ≥ 1`);
        return;
      }
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(total) || total < 0) {
        failValidation(`Invoice dòng ${idx + 1}: đơn giá và tổng tiền phải là số ≥ 0`);
        return;
      }
      normalizedInvoices.push({
        invoiceGoodsDetails: inv.invoiceGoodsDetails.trim(),
        invoiceQuantity: qty,
        invoiceUnit: inv.invoiceUnit,
        invoicePrice: price,
        invoiceTotalPrice: total,
      });
    }

    if (form.customerNote.trim().length > MAX_CUSTOMER_NOTE_LENGTH) {
      failValidation(`Ghi chú cho khách không được vượt quá ${MAX_CUSTOMER_NOTE_LENGTH} ký tự`);
      return;
    }

    const payload = {
      receiverCompanyName: form.receiverCompanyName.trim(),
      receiverContactName: form.receiverContactName.trim(),
      receiverTelephone: form.receiverTelephone.trim(),
      receiverCountry: form.receiverCountry.trim(),
      receiverStateName: form.receiverStateName.trim(),
      receiverCity: form.receiverCity.trim(),
      receiverPostalCode: form.receiverPostalCode.trim(),
      receiverAddress1: form.receiverAddress1.trim(),
      receiverAddress2: form.receiverAddress2.trim() || null,
      receiverAddress3: form.receiverAddress3.trim() || null,
      shipmentService: form.shipmentService.trim(),
      shipmentSignatureFlg: form.shipmentSignatureFlg,
      shipmentBranch: form.shipmentBranch,
      shipmentReferenceCode: form.shipmentReferenceCode.trim() || null,
      shipmentGoodsName: form.shipmentGoodsName.trim(),
      shipmentValue: parsedShipmentValue,
      shipmentExportAs: form.shipmentExportAs,
      packages: packages.map((p) => ({
        packageQuantity: Number(p.packageQuantity),
        packageType: p.packageType,
        packageLength: Number(p.packageLength),
        packageWidth: Number(p.packageWidth),
        packageHeight: Number(p.packageHeight),
        packageWeight: Number(p.packageWeight),
      })),
      invoices: normalizedInvoices,
      customerNote: form.customerNote.trim() || null,
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
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Lưu bill thất bại (HTTP ${res.status})`;
        setError(msg);
        toast(msg, "error");
        return;
      }

      if (initial) {
        toast("Đã lưu thay đổi bill", "success");
        router.push(`/admin/kango-bills/${initial.id}`);
        router.refresh();
        return;
      }

      const newBillId = json?.id as number;
      let uploadWarning = "";
      if (imageFiles.length > 0 && newBillId) {
        try {
          const formData = new FormData();
          for (const file of imageFiles) formData.append("images", file);
          const uploadRes = await fetch(`/api/admin/kango-bills/${newBillId}/images`, {
            method: "POST",
            body: formData,
          });
          if (!uploadRes.ok) {
            const uploadJson = await uploadRes.json().catch(() => null);
            uploadWarning = uploadJson?.error || "Không tải được ảnh kiện hàng";
          }
        } catch {
          uploadWarning = "Lỗi mạng khi tải ảnh kiện hàng";
        }
      }

      if (uploadWarning) {
        toast(`Bill #${newBillId} đã tạo nhưng tải ảnh lỗi: ${uploadWarning}`, "error");
        router.push(`/admin/kango-bills/${newBillId}?imageUploadError=${encodeURIComponent(uploadWarning)}`);
      } else {
        toast(`Đã tạo bill nháp #${newBillId}`, "success");
        router.push(`/admin/kango-bills/${newBillId}`);
      }
      router.refresh();
    } catch {
      const msg = "Không kết nối được tới máy chủ — vui lòng kiểm tra lại mạng và thử lại";
      setError(msg);
      toast(msg, "error");
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
              <option key={`${r.receiverTelephone}-${i}`} value={i}>
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
              min="0.01"
              step="any"
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
              <NumField label="SL" min="1" step="1" value={p.packageQuantity} onChange={(v) => updatePackage(i, { packageQuantity: v })} />
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
              <NumField label="Dài (cm)" min="0.1" step="any" value={p.packageLength} onChange={(v) => updatePackage(i, { packageLength: v })} />
              <NumField label="Rộng (cm)" min="0.1" step="any" value={p.packageWidth} onChange={(v) => updatePackage(i, { packageWidth: v })} />
              <NumField label="Cao (cm)" min="0.1" step="any" value={p.packageHeight} onChange={(v) => updatePackage(i, { packageHeight: v })} />
              <div className="flex items-end gap-1">
                <NumField label="Cân (kg)" min="0.01" step="any" value={p.packageWeight} onChange={(v) => updatePackage(i, { packageWeight: v })} />
                {packages.length > 1 && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setPackages((prev) => prev.filter((_, idx) => idx !== i))}
                    title="Xoá kiện hàng"
                    aria-label={`Xoá kiện hàng ${i + 1}`}
                    className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink/40 hover:bg-flame-50 hover:text-flame-700 disabled:opacity-40"
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
              <NumField label="SL" min="1" step="1" value={inv.invoiceQuantity} onChange={(v) => updateInvoice(i, { invoiceQuantity: v })} />
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
              <NumField label="Đơn giá" min="0" step="any" value={inv.invoicePrice} onChange={(v) => updateInvoice(i, { invoicePrice: v })} />
              <div className="flex items-end gap-1">
                <NumField label="Tổng tiền" min="0" step="any" value={inv.invoiceTotalPrice} onChange={(v) => updateInvoice(i, { invoiceTotalPrice: v })} />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setInvoices((prev) => prev.filter((_, idx) => idx !== i))}
                  title="Xoá dòng invoice"
                  aria-label={`Xoá dòng invoice ${i + 1}`}
                  className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink/40 hover:bg-flame-50 hover:text-flame-700 disabled:opacity-40"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {invoices.length === 0 && <p className="text-xs text-ink/45">Không bắt buộc — chỉ cần khi có yêu cầu khai invoice chi tiết.</p>}
          {invoiceMismatch && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Lưu ý: Tổng tiền invoice ({invoiceSum.toFixed(2)} USD) đang lệch so với Giá trị kiện hàng ({shipmentValueNum.toFixed(2)} USD).
            </p>
          )}
        </div>
      </section>

      {!initial && (
        <section className="rounded-xl border border-line bg-white p-4">
          <p className="font-display text-sm font-bold text-navy-900">
            Ảnh kiện hàng (tuỳ chọn) ({imageFiles.length}/{MAX_KANGO_BILL_IMAGES})
          </p>
          <p className="mt-1 text-xs text-ink/50">
            Chọn ảnh kiện hàng đã đóng (JPEG, PNG, WebP · ≤ 5 MB/ảnh · tối đa {MAX_KANGO_BILL_IMAGES} ảnh). Ảnh sẽ tự tải lên ngay sau khi lưu bill.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={saving || imageFiles.length >= MAX_KANGO_BILL_IMAGES}
            onChange={handleImageSelect}
            className="mt-2.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-flame-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-flame-700 disabled:opacity-50"
          />
          {imageError && <p className="mt-2 text-xs font-medium text-flame-700">{imageError}</p>}
          {imagePreviews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2.5">
              {imagePreviews.map((src, idx) => (
                <div key={src} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={imageFiles[idx]?.name ?? ""} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                    title="Bỏ ảnh này"
                    aria-label={`Bỏ ảnh ${imageFiles[idx]?.name ?? idx + 1}`}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-ink/70 shadow-sm hover:bg-flame-600 hover:text-white disabled:opacity-40"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-line bg-white p-4">
        <label htmlFor="customer-note" className="font-display text-sm font-bold text-navy-900">
          Ghi chú cho khách (in lên mặt bill)
        </label>
        <textarea
          id="customer-note"
          rows={3}
          maxLength={MAX_CUSTOMER_NOTE_LENGTH}
          value={form.customerNote}
          onChange={(e) => setForm({ ...form, customerNote: e.target.value })}
          placeholder="Vd: Thiếu tên tiệm và SĐT người nhận – anh/chị bổ sung giúp Falco"
          className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
        />
        <p className="mt-1 text-right text-xs text-ink/45">
          {form.customerNote.length}/{MAX_CUSTOMER_NOTE_LENGTH}
        </p>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-flame-200 bg-flame-50 px-4 py-2.5 text-sm font-medium text-flame-800"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Lưu bill (nháp)"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => router.back()}
          className="btn-outline !px-5 !py-2.5 text-sm disabled:opacity-50"
        >
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

function NumField({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/60">{label}</label>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
      />
    </div>
  );
}
