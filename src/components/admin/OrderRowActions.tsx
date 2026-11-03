"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PencilIcon, TrashIcon } from "@/components/icons";

type OrderDetail = {
  awb: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_postcode: string | null;
  service: string | null;
  destination: string | null;
  received_date: string | null;
  weight_kg: string | null;
};

/**
 * Chuyển ISO datetime (UTC) từ API sang "YYYY-MM-DD" cho input type=date, dùng
 * các thành phần giờ ĐỊA PHƯƠNG (getFullYear/getMonth/getDate) thay vì cắt
 * chuỗi UTC — cắt chuỗi trực tiếp sẽ lùi mất 1 ngày ở múi giờ UTC+7 vì DATE
 * lúc 00:00 giờ VN ứng với 17:00 UTC hôm trước.
 */
function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function OrderRowActions({
  orderId,
  falcoCode,
}: {
  orderId: number;
  falcoCode: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<OrderDetail | null>(null);
  const [trackingCodes, setTrackingCodes] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    fetch(`/api/admin/orders/${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        const o = data.order;
        setForm({
          awb: o.awb || "",
          recipient_name: o.recipient_name || "",
          recipient_phone: o.recipient_phone || "",
          recipient_postcode: o.recipient_postcode || "",
          service: o.service || "",
          destination: o.destination || "",
          received_date: o.received_date ? toDateInputValue(o.received_date) : "",
          weight_kg: o.weight_kg ?? "",
        });
        setTrackingCodes(
          (data.parcels as { tracking_code: string }[]).map((p) => p.tracking_code).join("\n")
        );
      })
      .catch(() => setError("Không tải được dữ liệu đơn hàng"))
      .finally(() => setLoading(false));
  }, [open, orderId]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awb: form.awb,
          recipientName: form.recipient_name,
          recipientPhone: form.recipient_phone,
          recipientPostcode: form.recipient_postcode,
          service: form.service,
          destination: form.destination,
          receivedDate: form.received_date || null,
          weightKg: form.weight_kg === "" ? null : Number(form.weight_kg),
          trackingCodes: trackingCodes.split("\n"),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Không lưu được thay đổi");
        return;
      }
      setOpen(false);
      toast(`Đã lưu đơn ${falcoCode}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Xoá đơn ${falcoCode}? Hành động này không thể hoàn tác.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
      if (res.ok) {
        toast(`Đã xoá đơn ${falcoCode}`);
        router.refresh();
      } else {
        toast("Không xoá được đơn hàng", "error");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-mist hover:text-navy-800"
          title="Sửa đơn"
          aria-label={`Sửa đơn ${falcoCode}`}
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-flame-50 hover:text-flame-700 disabled:opacity-50"
          title="Xoá đơn"
          aria-label={`Xoá đơn ${falcoCode}`}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={saving}
        size="lg"
        title={`Sửa đơn ${falcoCode}`}
        subtitle="Thông tin người nhận, kiện hàng và mã tracking"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} disabled={saving} className="btn-outline !px-4 !py-2 text-sm">
              Huỷ
            </button>
            <button type="submit" form={`edit-order-${orderId}`} disabled={saving || loading} className="btn-primary !px-5 !py-2 text-sm disabled:opacity-60">
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </>
        }
      >
        {loading ? (
          <div className="space-y-3 py-2" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-line/60" />
            ))}
          </div>
        ) : form ? (
          <form
            id={`edit-order-${orderId}`}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
          >
            <Field label="AWB" value={form.awb} onChange={(v) => setForm({ ...form, awb: v })} />
            <Field label="Ngày nhận" type="date" value={form.received_date || ""} onChange={(v) => setForm({ ...form, received_date: v })} />
            <Field label="Người nhận" value={form.recipient_name || ""} onChange={(v) => setForm({ ...form, recipient_name: v })} />
            <Field label="Điện thoại" value={form.recipient_phone || ""} onChange={(v) => setForm({ ...form, recipient_phone: v })} />
            <Field label="Postcode" value={form.recipient_postcode || ""} onChange={(v) => setForm({ ...form, recipient_postcode: v })} hint="Chỉ hiện trong admin, dùng để tra DPD/DHL" />
            <Field label="Dịch vụ" value={form.service || ""} onChange={(v) => setForm({ ...form, service: v })} />
            <Field label="Điểm đến" value={form.destination || ""} onChange={(v) => setForm({ ...form, destination: v })} />
            <Field label="Cân nặng (kg)" type="number" value={String(form.weight_kg ?? "")} onChange={(v) => setForm({ ...form, weight_kg: v })} />
            <div className="sm:col-span-2">
              <label htmlFor={`trk-${orderId}`} className="text-xs font-semibold text-ink/60">
                Mã tracking <span className="font-normal text-ink/40">(mỗi kiện 1 dòng)</span>
              </label>
              <textarea
                id={`trk-${orderId}`}
                value={trackingCodes}
                onChange={(e) => setTrackingCodes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-flame-50 px-3 py-2 text-xs font-medium text-flame-700 sm:col-span-2" role="alert">
                {error}
              </p>
            )}
          </form>
        ) : (
          error && <p className="text-sm text-flame-700">{error}</p>
        )}
      </Modal>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "number";
  hint?: string;
}) {
  const id = `f-${label}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-ink/60">
        {label}
      </label>
      <input
        id={id}
        type={type}
        step={type === "number" ? "0.1" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink transition-colors focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
      />
      {hint && <p className="mt-1 text-[11px] text-ink/40">{hint}</p>}
    </div>
  );
}
