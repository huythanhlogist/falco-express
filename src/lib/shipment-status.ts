import type { KangoTrackingResponse } from "./kango";

/**
 * Các mốc chính của một đơn Falco → châu Âu/Anh (nhãn ngắn, cùng kiểu, để hiện ở cột trạng thái):
 *   Chờ nhận → Đã nhận → Đã xuất → Đang thông quan → Đã thông quan → Đang giao → Đã giao (+ Hoàn trả)
 *   imported → received → exported → customs_processing → customs_released → last_mile → delivered. `in_transit` và `customs` là giá trị CŨ còn trong enum DB (bản cache
 * trước đây), không còn được sinh ra nữa.
 */
export type ShipmentStatus =
  | "imported"
  | "received"
  | "exported"
  | "customs_processing"
  | "customs_released"
  | "last_mile"
  | "delivered"
  | "returned"
  | "in_transit"
  | "customs";

export const SHIPMENT_STATUS_OPTIONS: { value: ShipmentStatus; label: string; className: string }[] = [
  { value: "imported", label: "Chờ nhận", className: "bg-slate-100 text-slate-600" },
  { value: "received", label: "Đã nhận", className: "bg-sky-50 text-sky-700" },
  { value: "exported", label: "Đã xuất", className: "bg-cyan-50 text-cyan-700" },
  { value: "customs_processing", label: "Đang thông quan", className: "bg-amber-50 text-amber-700" },
  { value: "customs_released", label: "Đã thông quan", className: "bg-indigo-50 text-indigo-700" },
  { value: "last_mile", label: "Đang giao", className: "bg-violet-50 text-violet-700" },
  { value: "delivered", label: "Đã giao", className: "bg-emerald-50 text-emerald-700" },
  { value: "returned", label: "Hoàn trả", className: "bg-rose-50 text-rose-700" },
  // Giá trị cũ (chỉ để hiển thị nếu còn sót trong DB)
  { value: "in_transit", label: "Đã xuất", className: "bg-cyan-50 text-cyan-700" },
  { value: "customs", label: "Đang thông quan", className: "bg-amber-50 text-amber-700" },
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

// Mốc (1-5) của một sự kiện Kango theo nội dung tiêu đề; 0 = không nhận ra.
// Từ vựng lấy từ lịch sử thật của các đơn (Kango + hãng chặng cuối DHL/DPD/UPS).
function stageOfTitle(title: string): number {
  const s = title.toLowerCase().trim();

  // Thông quan đến (4: đã thông quan, 3: đang thông quan / vừa hạ cánh)
  if (/destination customs released/.test(s)) return 4;
  if (/destination customs|arrived destination airport/.test(s)) return 3;

  // Đã xuất đi (2): quét xuất kho, hải quan đi, ra sân bay, bay, transit
  if (/export scan|origin customs|departed|arrived transit airport|waiting for|offload|in transit noi bai|transit to/.test(s)) {
    return 2;
  }

  // Giao dịch sớm / thông báo trước (1): nhận hàng, tạo nhãn, hãng nhận dữ liệu điện tử
  if (
    s === "we have your parcel" ||
    s.startsWith("label created") ||
    /instruction data|order information has been transmitted|pickup ordered|not yet received your parcel/.test(s)
  ) {
    return 1;
  }

  // Hãng chặng cuối đã nhận/đang xử lý ở nước đến (5)
  if (
    /parcel cent(er|re)|delivery (vehicle|depot|base|cent(er|re))|out for delivery|depot|region of recipient|prepared for delivery|with you today|packstation|destination country|delivery organization|reception option|delivery day|zustellung|nachverpackung|repackaged|at parcel/.test(
      s
    )
  ) {
    return 5;
  }

  return 0;
}

const NEGATIVE_DELIVERED = /\bnot\b.{0,40}\bdelivered\b|could not be delivered/;
const DELIVERED = /\bdelivered\b|picked up|pick-up was successful/;
// Sự kiện sau khi đã thông quan mà thuộc nhóm bay/hải quan/transit thì chưa phải chặng cuối.
const NOT_LAST_MILE = /customs|airport|flight|departed|arrived|offload|transit/;

/**
 * Kango không có mã trạng thái chuẩn (status_class lỗi thời, sự kiện là câu tự do của hãng
 * chặng cuối) nên quy trạng thái từ TOÀN BỘ lịch sử: lấy mốc xa nhất từng đạt. Sau khi đã
 * thông quan, bất kỳ sự kiện nào mới hơn không thuộc nhóm bay/hải quan đều coi là đã nối
 * last mile — bắt được cả câu lạ của hãng chưa gặp. Giao hàng/hoàn trả luôn ưu tiên.
 */
export function mapKangoStatus(kango: KangoTrackingResponse | null): ShipmentStatus {
  const events = kango?.trackings ?? [];
  if (!kango || events.length === 0) return "imported";

  const parcels = kango.shipment_information?.order_numbers ?? [];
  const titles = events.map((e) => (e.title ?? "").toLowerCase());

  if (
    (parcels.length > 0 && parcels.every((p) => p.is_returned)) ||
    titles.some((t) => /return(ed)? to (sender|origin)|\breturned\b/.test(t))
  ) {
    return "returned";
  }
  // Đã giao: có sự kiện giao thành công VÀ sau đó không còn sự kiện bay/hải quan mới hơn
  // (đơn gửi nhiều phần "PART 1/2" có thể đã giao 1 phần, phần còn lại vẫn đang đi).
  let deliveredTime = "";
  events.forEach((e, i) => {
    if (DELIVERED.test(titles[i]) && !NEGATIVE_DELIVERED.test(titles[i]) && (e.time ?? "") > deliveredTime) {
      deliveredTime = e.time ?? "";
    }
  });
  if (deliveredTime) {
    const inFlightAfter = events.some((e) => {
      const st = stageOfTitle(e.title ?? "");
      return (e.time ?? "") > deliveredTime && st >= 2 && st <= 4;
    });
    if (!inFlightAfter) return "delivered";
  }

  let stage = 0;
  let releasedTime = "";
  for (const e of events) {
    const st = stageOfTitle(e.title ?? "");
    if (st > stage) stage = st;
    if (st === 4 && (e.time ?? "") > releasedTime) releasedTime = e.time ?? "";
  }
  if (releasedTime && stage < 5) {
    const afterRelease = events.some(
      (e) => (e.time ?? "") > releasedTime && stageOfTitle(e.title ?? "") === 0 && !NOT_LAST_MILE.test((e.title ?? "").toLowerCase())
    );
    if (afterRelease) stage = 5;
  }

  switch (stage) {
    case 5:
      return "last_mile";
    case 4:
      return "customs_released";
    case 3:
      return "customs_processing";
    case 2:
      return "exported";
    default:
      return "received";
  }
}
