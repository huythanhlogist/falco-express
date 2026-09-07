"use client";

import { useState, useTransition } from "react";

export default function PaymentToggle({
  orderId,
  initialStatus,
}: {
  orderId: number;
  initialStatus: "paid" | "unpaid";
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = status === "paid" ? "unpaid" : "paid";
    startTransition(async () => {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: next }),
      });
      if (res.ok) setStatus(next);
    });
  }

  const paid = status === "paid";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
        paid
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-flame-50 text-flame-700 hover:bg-flame-100"
      }`}
    >
      {isPending ? "Đang cập nhật..." : paid ? "Đã thanh toán" : "Chưa thanh toán"}
    </button>
  );
}
