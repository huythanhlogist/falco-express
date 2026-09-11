import type { OrderReviewStatus } from "@/lib/db";

export type { OrderReviewStatus };

export const REVIEW_STATUS_LABELS: Record<OrderReviewStatus, string> = {
  auto_approved: "Đơn của mình",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

export const REVIEW_STATUS_CLASSNAMES: Record<OrderReviewStatus, string> = {
  auto_approved: "bg-mist text-ink/50",
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-flame-50 text-flame-700",
};

export function reviewStatusLabel(status: OrderReviewStatus): string {
  return REVIEW_STATUS_LABELS[status] ?? status;
}

export function reviewStatusClassName(status: OrderReviewStatus): string {
  return REVIEW_STATUS_CLASSNAMES[status] ?? "";
}
