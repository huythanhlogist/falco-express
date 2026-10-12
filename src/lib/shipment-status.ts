import type { KangoTrackingResponse } from "./kango";

export type ShipmentStatus = "imported" | "in_transit" | "customs" | "delivered" | "returned";

export const SHIPMENT_STATUS_OPTIONS: { value: ShipmentStatus; label: string; className: string }[] = [
  { value: "imported", label: "Đã nhập", className: "bg-slate-100 text-slate-600" },
  { value: "in_transit", label: "Đang vận chuyển", className: "bg-sky-50 text-sky-700" },
  { value: "customs", label: "Thông quan", className: "bg-indigo-50 text-indigo-700" },
  { value: "delivered", label: "Đã giao", className: "bg-emerald-50 text-emerald-700" },
  { value: "returned", label: "Hoàn trả", className: "bg-rose-50 text-rose-700" },
];

export function shipmentStatusLabel(status: ShipmentStatus): string {
  return SHIPMENT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function shipmentStatusClassName(status: ShipmentStatus): string {
  return SHIPMENT_STATUS_OPTIONS.find((o) => o.value === status)?.className ?? "";
}

export function isFinalShipmentStatus(status: ShipmentStatus): boolean {
  return status === "delivered" || status === "returned";
}

/**
 * Kango không trả mã trạng thái chuẩn cho trạng thái HIỆN TẠI: sự kiện mới
 * nhất (trackings[0].title) là câu tự do do hãng chuyển cuối chặng đưa vào
 * ("The shipment has been successfully delivered", "Delivered.", "Your parcel
 * has been delivered"...), còn order_numbers[].status_class có dạng mã nhưng
 * hay lỗi thời (vẫn "customs_cleared" dù đã giao). Nên quy trạng thái theo
 * câu sự kiện mới nhất, bảng map dựng từ dữ liệu thật của đơn 30 ngày gần
 * nhất. Câu "đã giao" lạ chưa gặp sẽ rơi vào in_transit — đơn chỉ bị gọi lại
 * thêm đến hết cửa sổ 30 ngày, không sai dữ liệu (text gốc luôn được lưu).
 */
export function mapKangoStatus(kango: KangoTrackingResponse | null): ShipmentStatus {
  const title = kango?.trackings?.[0]?.title?.trim() ?? "";
  if (!kango || !title) return "imported";

  const parcels = kango.shipment_information?.order_numbers ?? [];
  const t = title.toLowerCase();

  if (
    (parcels.length > 0 && parcels.every((p) => p.is_returned)) ||
    /return(ed)? to (sender|origin)|\breturned\b/.test(t)
  ) {
    return "returned";
  }
  if (!/\bnot\b.{0,30}\bdelivered\b/.test(t) && /\bdelivered\b|picked up/.test(t)) {
    return "delivered";
  }
  if (t.includes("destination customs")) return "customs";
  return "in_transit";
}
