import type { PaymentStatus } from "@/lib/db";

export type { PaymentStatus };

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string; className: string }[] = [
  { value: "unpaid", label: "Chưa thu", className: "bg-flame-50 text-flame-700" },
  { value: "collected_by_staff", label: "Thu hộ", className: "bg-amber-50 text-amber-700" },
  { value: "paid", label: "Đã thu", className: "bg-emerald-50 text-emerald-700" },
];

export function statusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function statusClassName(status: PaymentStatus): string {
  return PAYMENT_STATUS_OPTIONS.find((o) => o.value === status)?.className ?? "";
}
