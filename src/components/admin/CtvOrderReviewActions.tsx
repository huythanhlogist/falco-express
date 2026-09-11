"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewStatusClassName, reviewStatusLabel, type OrderReviewStatus } from "@/lib/review-status";

export default function CtvOrderReviewActions({
  orderId,
  reviewStatus,
  ctvCode,
}: {
  orderId: number;
  reviewStatus: OrderReviewStatus;
  ctvCode: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function act(action: "approve" | "reject") {
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/admin/orders/${orderId}/${action}`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Có lỗi xảy ra");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {ctvCode && <span className="text-xs font-bold text-navy-800">{ctvCode}</span>}
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${reviewStatusClassName(reviewStatus)}`}>
          {reviewStatusLabel(reviewStatus)}
        </span>
      </div>
      {reviewStatus === "pending" && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={isPending}
            className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
          >
            Duyệt
          </button>
          <button
            type="button"
            onClick={() => act("reject")}
            disabled={isPending}
            className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
          >
            Từ chối
          </button>
        </div>
      )}
      {error && <p className="text-xs text-flame-700">{error}</p>}
    </div>
  );
}
