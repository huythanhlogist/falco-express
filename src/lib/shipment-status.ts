import type { KangoTrackingResponse } from "./kango";

/**
 * Các mốc chính của một đơn Falco → châu Âu/Anh (nhãn ngắn, cùng kiểu, để hiện ở cột trạng thái):
 *   Đã nhận → Đã xuất (sau hải quan VN) → Đang thông quan → Đã thông quan → Đang giao → Đã giao (+ Hoàn trả)
 *   received → exported → customs_processing → customs_released → last_mile → delivered.
 * `imported` là giá trị cũ (đơn chưa có sự kiện) — nay cũng hiển thị là "Đã nhận". `in_transit` và `customs` là giá trị CŨ còn trong enum DB (bản cache
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
  { value: "imported", label: "Đã nhận", className: "bg-sky-50 text-sky-700" },
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

  // Đã xuất (2): chỉ tính SAU khi qua hải quan Việt Nam — tức từ lúc máy bay cất cánh
  // (departed) trở đi: transit, chờ chuyến nối, đổi chuyến.
  if (/departed|arrived transit airport|waiting for|offload|transit to/.test(s)) return 2;

  // Đã nhận (1): nhận hàng, tạo nhãn, quét xuất kho, đang làm hải quan Việt Nam, ra sân bay Nội Bài,
  // cùng các thông báo trước của hãng (chưa bay).
  if (
    s === "we have your parcel" ||
    s.startsWith("label created") ||
    /export scan|origin customs|in transit noi bai|instruction data|order information has been transmitted|pickup ordered|not yet received your parcel/.test(s)
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
  // Đơn đã lên hệ thống thì coi là đã nhận hàng, kể cả khi Kango chưa có sự kiện nào.
  if (!kango || events.length === 0) return "received";

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

/** Thời điểm giao thành công gần nhất trong hành trình Kango ("" nếu chưa giao). */
export function deliveredTimeOf(kango: KangoTrackingResponse | null): string {
  let deliveredTime = "";
  for (const e of kango?.trackings ?? []) {
    const t = (e.title ?? "").toLowerCase();
    if (DELIVERED.test(t) && !NEGATIVE_DELIVERED.test(t) && (e.time ?? "") > deliveredTime) {
      deliveredTime = e.time ?? "";
    }
  }
  return deliveredTime;
}

/** 6 mốc hiển thị trên timeline trang tra cứu, theo đúng thứ tự hành trình. */
export const TRACKING_MILESTONES = [
  { key: "received", label: "Đã nhận hàng" },
  { key: "exported", label: "Đã bay" },
  { key: "customs_processing", label: "Đang thông quan" },
  { key: "customs_released", label: "Đã thông quan" },
  { key: "last_mile", label: "Đang giao" },
  { key: "delivered", label: "Đã giao" },
] as const;

const MILESTONE_INDEX: Partial<Record<ShipmentStatus, number>> = {
  imported: 0,
  received: 0,
  exported: 1,
  in_transit: 1,
  customs_processing: 2,
  customs: 2,
  customs_released: 3,
  last_mile: 4,
  delivered: 5,
};

/** Vị trí mốc hiện tại trên timeline (0–5); hoàn trả trả về -1. */
export function milestoneIndexOf(status: ShipmentStatus): number {
  return MILESTONE_INDEX[status] ?? -1;
}

/**
 * Thời điểm (chuỗi thời gian Kango) đạt từng mốc — lấy sự kiện SỚM NHẤT thuộc
 * mốc đó hoặc mốc sau. Mốc không có sự kiện tương ứng (vd Kango bỏ qua "đang
 * thông quan") để trống, giao diện vẫn tô đã qua theo trạng thái tổng.
 */
export function milestoneTimesOf(kango: KangoTrackingResponse | null): string[] {
  const times = ["", "", "", "", "", ""];
  for (const e of kango?.trackings ?? []) {
    const st = stageOfTitle(e.title ?? "");
    if (st === 0) continue;
    const idx = st - 1; // stage 1..5 → mốc 0..4
    const time = e.time ?? "";
    if (time && (!times[idx] || time < times[idx])) times[idx] = time;
  }
  times[5] = deliveredTimeOf(kango);
  return times;
}
