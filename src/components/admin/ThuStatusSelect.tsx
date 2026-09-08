"use client";

import { useState, useTransition } from "react";
import {
  PAYMENT_STATUS_OPTIONS,
  statusLabel,
  statusClassName,
  type PaymentStatus,
} from "@/lib/payment-status";

export type { PaymentStatus };
export { statusLabel, statusClassName };

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

  const opt = PAYMENT_STATUS_OPTIONS.find((o) => o.value === status) ?? PAYMENT_STATUS_OPTIONS[0];

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => change(e.target.value as PaymentStatus)}
      className={`rounded-full border-0 px-3 py-1 text-xs font-bold outline-none disabled:opacity-50 ${opt.className}`}
    >
      {PAYMENT_STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
