"use client";

import { useState, useTransition } from "react";

export type PaymentStatus = "unpaid" | "collected_by_staff" | "paid";

const OPTIONS: { value: PaymentStatus; label: string; className: string }[] = [
  { value: "unpaid", label: "Chưa thu", className: "bg-flame-50 text-flame-700" },
  { value: "collected_by_staff", label: "Thu hộ", className: "bg-amber-50 text-amber-700" },
  { value: "paid", label: "Đã thu", className: "bg-emerald-50 text-emerald-700" },
];

export function statusLabel(status: PaymentStatus): string {
  return OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function statusClassName(status: PaymentStatus): string {
  return OPTIONS.find((o) => o.value === status)?.className ?? "";
}

export default function ThuStatusSelect({
  orderId,
  initialStatus,
  onChanged,
}: {
  orderId: number;
  initialStatus: PaymentStatus;
  onChanged?: (status: PaymentStatus) => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  function change(next: PaymentStatus) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: next }),
      });
      if (res.ok) {
        setStatus(next);
        onChanged?.(next);
      }
    });
  }

  const opt = OPTIONS.find((o) => o.value === status) ?? OPTIONS[0];

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => change(e.target.value as PaymentStatus)}
      className={`rounded-full border-0 px-3 py-1 text-xs font-bold outline-none disabled:opacity-50 ${opt.className}`}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
