"use client";

import { useState, useTransition } from "react";
import { reviewStatusClassName, reviewStatusLabel, type OrderReviewStatus } from "@/lib/review-status";

type CtvOrder = {
  id: number;
  falco_code: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  service: string | null;
  destination: string | null;
  received_date: string | null;
  weight_kg: string | null;
  amount: string | null;
  review_status: OrderReviewStatus;
};

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

function money(v: string | null): string {
  if (!v) return "—";
  return `${Number(v).toLocaleString("vi-VN")}đ`;
}

export default function CtvOrdersList({ initialOrders }: { initialOrders: CtvOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!form.recipientName.trim() || !form.recipientPhone.trim() || !form.destination.trim()) {
      setError("Vui lòng nhập tên người nhận, SĐT và điểm đến");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/ctv/orders", {
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
      setOrders((prev) => [
        {
          id: json.id,
          falco_code: json.falcoCode,
          recipient_name: form.recipientName,
          recipient_phone: form.recipientPhone,
          service: form.service,
          destination: form.destination,
          received_date: form.receivedDate || null,
          weight_kg: form.weightKg || null,
          amount: form.amount || null,
          review_status: "pending",
        },
        ...prev,
      ]);
      setForm(EMPTY_FORM);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(o: CtvOrder) {
    setEditingId(o.id);
    setEditForm({
      recipientName: o.recipient_name ?? "",
      recipientPhone: o.recipient_phone ?? "",
      service: o.service ?? "",
      destination: o.destination ?? "",
      receivedDate: o.received_date ? o.received_date.slice(0, 10) : "",
      weightKg: o.weight_kg ?? "",
      amount: o.amount ?? "",
    });
  }

  function saveEdit(id: number) {
    startTransition(async () => {
      const res = await fetch(`/api/ctv/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: editForm.recipientName,
          recipientPhone: editForm.recipientPhone,
          service: editForm.service,
          destination: editForm.destination,
          receivedDate: editForm.receivedDate || null,
          weightKg: editForm.weightKg ? Number(editForm.weightKg) : null,
          amount: editForm.amount ? Number(editForm.amount) : null,
        }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  recipient_name: editForm.recipientName,
                  recipient_phone: editForm.recipientPhone,
                  service: editForm.service,
                  destination: editForm.destination,
                  received_date: editForm.receivedDate || null,
                  weight_kg: editForm.weightKg || null,
                  amount: editForm.amount || null,
                }
              : o
          )
        );
        setEditingId(null);
      }
    });
  }

  function removeOrder(id: number) {
    if (!confirm("Xoá đơn này?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/ctv/orders/${id}`, { method: "DELETE" });
      if (res.ok) setOrders((prev) => prev.filter((o) => o.id !== id));
    });
  }

  return (
    <div>
      <form onSubmit={createOrder} className="rounded-xl border border-line bg-white p-5">
        <p className="font-display text-sm font-bold text-navy-900">Tạo đơn mới</p>
        <p className="mt-1 text-xs text-ink/50">
          Đơn sẽ ở trạng thái &quot;Chờ duyệt&quot; cho tới khi Falco xác nhận — bạn vẫn sửa/xoá được trong lúc chờ.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Tên người nhận"
            value={form.recipientName}
            onChange={(v) => setForm({ ...form, recipientName: v })}
          />
          <TextField
            label="Điện thoại"
            value={form.recipientPhone}
            onChange={(v) => setForm({ ...form, recipientPhone: v })}
          />
          <TextField label="Dịch vụ" value={form.service} onChange={(v) => setForm({ ...form, service: v })} />
          <TextField
            label="Điểm đến"
            value={form.destination}
            onChange={(v) => setForm({ ...form, destination: v })}
          />
          <div>
            <label className="text-xs font-semibold text-ink/60">Cân nặng (kg)</label>
            <input
              type="number"
              step="0.1"
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">Báo giá cho khách (đ)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
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
        {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}
        <button type="submit" disabled={creating} className="btn-primary mt-4 !px-4 !py-2 text-sm disabled:opacity-50">
          {creating ? "Đang tạo..." : "Tạo đơn"}
        </button>
      </form>

      <div className="mt-5 flex flex-col gap-2.5">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl border border-line bg-white p-4">
            {editingId === o.id ? (
              <div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField
                    label="Tên người nhận"
                    value={editForm.recipientName}
                    onChange={(v) => setEditForm({ ...editForm, recipientName: v })}
                  />
                  <TextField
                    label="Điện thoại"
                    value={editForm.recipientPhone}
                    onChange={(v) => setEditForm({ ...editForm, recipientPhone: v })}
                  />
                  <TextField
                    label="Dịch vụ"
                    value={editForm.service}
                    onChange={(v) => setEditForm({ ...editForm, service: v })}
                  />
                  <TextField
                    label="Điểm đến"
                    value={editForm.destination}
                    onChange={(v) => setEditForm({ ...editForm, destination: v })}
                  />
                  <div>
                    <label className="text-xs font-semibold text-ink/60">Cân nặng (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.weightKg}
                      onChange={(e) => setEditForm({ ...editForm, weightKg: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink/60">Báo giá cho khách (đ)</label>
                    <input
                      type="number"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(o.id)}
                    disabled={isPending}
                    className="btn-primary !px-3.5 !py-1.5 text-xs disabled:opacity-50"
                  >
                    Lưu
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="btn-outline !px-3.5 !py-1.5 text-xs"
                  >
                    Huỷ
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy-900">{o.falco_code}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${reviewStatusClassName(o.review_status)}`}
                    >
                      {reviewStatusLabel(o.review_status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink/70">
                    {o.recipient_name} · {o.recipient_phone} · {o.destination}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {o.weight_kg ? `${o.weight_kg}kg` : "Chưa có cân nặng"} · {money(o.amount)}
                  </p>
                </div>
                {o.review_status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(o)}
                      className="text-xs font-semibold text-navy-700 hover:underline"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => removeOrder(o.id)}
                      disabled={isPending}
                      className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
                    >
                      Xoá
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {orders.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink/45">
            Chưa có đơn nào.
          </p>
        )}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
