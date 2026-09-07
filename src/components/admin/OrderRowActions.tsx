"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, TrashIcon } from "@/components/icons";

type OrderDetail = {
  awb: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  service: string | null;
  destination: string | null;
  received_date: string | null;
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
          service: o.service || "",
          destination: o.destination || "",
          received_date: o.received_date ? toDateInputValue(o.received_date) : "",
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
          service: form.service,
          destination: form.destination,
          receivedDate: form.received_date || null,
          trackingCodes: trackingCodes.split("\n"),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Không lưu được thay đổi");
        return;
      }
      setOpen(false);
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
        router.refresh();
      } else {
        alert("Không xoá được đơn hàng");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 transition-colors hover:bg-mist hover:text-navy-800"
          title="Sửa đơn"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 transition-colors hover:bg-flame-50 hover:text-flame-700 disabled:opacity-50"
          title="Xoá đơn"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-navy-900">
              Sửa đơn {falcoCode}
            </p>

            {loading ? (
              <p className="mt-4 text-sm text-ink/50">Đang tải...</p>
            ) : form ? (
              <div className="mt-4 flex flex-col gap-3">
                <Field label="AWB" value={form.awb} onChange={(v) => setForm({ ...form, awb: v })} />
                <Field
                  label="Người nhận"
                  value={form.recipient_name || ""}
                  onChange={(v) => setForm({ ...form, recipient_name: v })}
                />
                <Field
                  label="Điện thoại"
                  value={form.recipient_phone || ""}
                  onChange={(v) => setForm({ ...form, recipient_phone: v })}
                />
                <Field
                  label="Dịch vụ"
                  value={form.service || ""}
                  onChange={(v) => setForm({ ...form, service: v })}
                />
                <Field
                  label="Điểm đến"
                  value={form.destination || ""}
                  onChange={(v) => setForm({ ...form, destination: v })}
                />
                <div>
                  <label className="text-xs font-semibold text-ink/60">Ngày nhận</label>
                  <input
                    type="date"
                    value={form.received_date || ""}
                    onChange={(e) => setForm({ ...form, received_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink/60">
                    Mã tracking (mỗi kiện 1 dòng)
                  </label>
                  <textarea
                    value={trackingCodes}
                    onChange={(e) => setTrackingCodes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                  />
                </div>
              </div>
            ) : null}

            {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-outline !px-4 !py-2 text-sm"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || loading}
                className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/60">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
      />
    </div>
  );
}
