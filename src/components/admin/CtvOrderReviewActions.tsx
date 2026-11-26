"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm, useToast } from "@/components/ui/Toast";
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
  const ask = useConfirm();
  const toast = useToast();
  const [refreshing, startRefresh] = useTransition();
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function act(action: "approve" | "reject") {
    const confirmed = await ask(
      action === "approve"
        ? `Duyệt đơn FWD${ctvCode ? ` (${ctvCode})` : ""}? Đơn sẽ được tính vào doanh thu và hoa hồng của FWD.`
        : `Từ chối đơn FWD${ctvCode ? ` (${ctvCode})` : ""}? Đơn sẽ không được tính hoa hồng và không thể duyệt lại.`,
      {
        confirmLabel: action === "approve" ? "Duyệt đơn" : "Từ chối",
        danger: action === "reject",
      }
    );
    if (!confirmed) return;

    setError("");
    setBusyAction(action);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/${action}`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const msg = json.error || "Có lỗi xảy ra";
        setError(msg);
        toast(msg, "error");
        return;
      }
      toast(action === "approve" ? "Đã duyệt đơn FWD" : "Đã từ chối đơn FWD", "success");
      startRefresh(() => router.refresh());
    } catch {
      const msg = "Không kết nối được máy chủ";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusyAction(null);
    }
  }

  const disabled = busyAction !== null || refreshing;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {ctvCode && <span className="text-xs font-bold text-[#132440]">{ctvCode}</span>}
        {/* Đơn nhân viên được gán cho FWD: chỉ hiện mã FWD, không kèm nhãn "Đơn của mình". */}
        {!(ctvCode && reviewStatus === "auto_approved") && (
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${reviewStatusClassName(reviewStatus)}`}
          >
            {reviewStatusLabel(reviewStatus)}
          </span>
        )}
      </div>
      {reviewStatus === "pending" && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={disabled}
            className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
          >
            {busyAction === "approve" ? "Đang lưu…" : "Duyệt"}
          </button>
          <button
            type="button"
            onClick={() => act("reject")}
            disabled={disabled}
            className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
          >
            {busyAction === "reject" ? "Đang lưu…" : "Từ chối"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-flame-700">{error}</p>}
    </div>
  );
}
