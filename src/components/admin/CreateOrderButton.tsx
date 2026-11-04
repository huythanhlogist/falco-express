"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useRouter } from "next/navigation";
import { CargoIcon } from "@/components/icons";

type FormState = {
  recipientName: string;
  recipientPhone: string;
  service: string;
  destination: string;
  receivedDate: string;
  weightKg: string;
  amount: string;
};

const EMPTY_FORM: FormState = {
  recipientName: "",
  recipientPhone: "",
  service: "",
  destination: "",
  receivedDate: "",
  weightKg: "",
  amount: "",
};

export default function CreateOrderButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function submit() {
    if (!form.recipientName.trim() || !form.recipientPhone.trim() || !form.destination.trim()) {
      setError("Vui lòng nhập tên người nhận, SĐT và điểm đến");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: form.recipientName,
          recipientPhone: form.recipientPhone,
          service: form.service,
          destination: form.destination,
          receivedDate: form.receivedDate || null,
          weightKg: form.weightKg ? Number(form.weightKg) : null,
          amount: form.amount ? Number(form.amount) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Không tạo được đơn");
        return;
      }
      setOpen(false);
      setForm(EMPTY_FORM);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary !px-3.5 !py-2 text-sm">
        <CargoIcon className="h-4 w-4" />
        Tạo đơn thủ công
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        busy={saving}
        title="Tạo đơn thủ công"
        subtitle="Dùng cho đơn không qua file Kango — đơn hiện ngay, tự động duyệt như đơn thường."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} disabled={saving} className="btn-outline !px-4 !py-2 text-sm">
              Huỷ
            </button>
            <button type="button" onClick={submit} disabled={saving} className="btn-primary !px-5 !py-2 text-sm disabled:opacity-60">
              {saving ? "Đang tạo…" : "Tạo đơn"}
            </button>
          </>
        }
      >
  <div className="flex flex-col gap-3">
    <Field
      label="Tên người nhận"
      value={form.recipientName}
      onChange={(v) => setForm({ ...form, recipientName: v })}
    />
    <Field
      label="Điện thoại"
      value={form.recipientPhone}
      onChange={(v) => setForm({ ...form, recipientPhone: v })}
    />
    <Field label="Dịch vụ" value={form.service} onChange={(v) => setForm({ ...form, service: v })} />
    <Field
      label="Điểm đến"
      value={form.destination}
      onChange={(v) => setForm({ ...form, destination: v })}
    />
    <div className="flex gap-3">
      <div className="flex-1">
        <label className="text-xs font-semibold text-ink/60">Cân nặng (kg)</label>
        <input
          type="number"
          step="0.1"
          value={form.weightKg}
          onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
        />
      </div>
      <div className="flex-1">
        <label className="text-xs font-semibold text-ink/60">Thu (đ)</label>
        <input
          type="number"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
        />
      </div>
    </div>
    <div>
      <label className="text-xs font-semibold text-ink/60">Ngày nhận</label>
      <input
        type="date"
        value={form.receivedDate}
        onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
      />
    </div>
  </div>

        {error && <p className="mt-3 text-xs font-medium text-flame-700" role="alert">{error}</p>}
      </Modal>
    </>
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
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
      />
    </div>
  );
}
