"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useConfirm, useToast } from "@/components/ui/Toast";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { toIsoDateLocal } from "@/lib/vn-date";

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

export default function OrderRowActions({
  orderId,
  falcoCode,
  onDeleted,
}: {
  orderId: number;
  falcoCode: string;
  onDeleted?: (id: number) => void;
}) {
  const ask = useConfirm();
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
    let cancelled = false;
    setLoading(true);
    setError("");
    setForm(null);
    fetch(`/api/admin/orders/${orderId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.order) {
          throw new Error(data.error || "Không tải được dữ liệu đơn hàng");
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const o = data.order;
        setForm({
          awb: o.awb || "",
          recipient_name: o.recipient_name || "",
          recipient_phone: o.recipient_phone || "",
          recipient_postcode: o.recipient_postcode || "",
          service: o.service || "",
          destination: o.destination || "",
          received_date: toIsoDateLocal(o.received_date) ?? "",
          weight_kg: o.weight_kg ?? "",
        });
        setTrackingCodes(
          Array.isArray(data.parcels)
            ? (data.parcels as { tracking_code: string }[]).map((p) => p.tracking_code).join("\n")
            : ""
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tải được dữ liệu đơn hàng");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  async function save() {
    if (!form) return;
    if (!form.awb.trim()) {
      setError("AWB không được để trống");
      return;
    }
    let parsedWeight: number | null = null;
    if (form.weight_kg !== null && String(form.weight_kg).trim() !== "") {
      const n = Number(form.weight_kg);
      if (!Number.isFinite(n) || n < 0) {
        setError("Cân nặng phải là số không âm hợp lệ");
        return;
      }
      parsedWeight = n;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awb: form.awb.trim(),
          recipientName: form.recipient_name,
          recipientPhone: form.recipient_phone,
          recipientPostcode: form.recipient_postcode,
          service: form.service,
          destination: form.destination,
          receivedDate: form.received_date || null,
          weightKg: parsedWeight,
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
    } catch {
      setError("Không kết nối được tới máy chủ — thử lại sau");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!await ask(`Xoá đơn ${falcoCode}? Đơn xoá vẫn có thể khôi phục từ Lịch sử chỉnh sửa đơn.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted?.(orderId);
        toast(`Đã xoá đơn ${falcoCode}`);
        router.refresh();
      } else {
        const json = await res.json().catch(() => ({}));
        toast(json.error || "Không xoá được đơn hàng", "error");
      }
    } catch {
      toast("Không kết nối được tới máy chủ — thử lại sau", "error");
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
            <button type="submit" form={`edit-order-${orderId}`} disabled={saving || loading || !form} className="btn-primary !px-5 !py-2 text-sm disabled:opacity-60">
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
          error && <p className="text-sm text-flame-700" role="alert">{error}</p>
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
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-ink/60">
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.1" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink transition-colors focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
      />
      {hint && <p className="mt-1 text-[11px] text-ink/40">{hint}</p>}
    </div>
  );
}
