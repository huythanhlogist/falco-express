import { bay, BayApiError, type BayShipment, type BayTracking } from "./bay-api";
import type { KangoTrackingResponse } from "./kango";
import type { ShipmentStatus } from "./shipment-status";

// Đưa hành trình BayOnline về đúng dạng KangoTrackingResponse để toàn bộ phần còn lại
// (cache, trang tra cứu công khai, cột "Vận chuyển" ở admin) dùng chung 1 luồng, không phải
// viết lại. Tiêu đề các mốc của Bay được chuẩn hoá sang tiếng Việt.

const BAY_EVENT_VI: Record<string, string> = {
  created_by_agency: "Đã tạo đơn",
  created_by_bay: "Đã tạo đơn",
  package_received: "Kho đã nhận kiện hàng",
  checked: "Đã kiểm hàng",
  weighed: "Đã cân hàng",
  label_assigned: "Đã gán mã vận đơn chặng cuối",
  to_airport: "Đang đưa ra sân bay",
  customs_cleared: "Đã thông quan nước đến",
  at_destination_warehouse: "Đã đến kho đầu cuối",
  handed_to_carrier: "Đã giao cho hãng vận chuyển nội địa",
  completed: "Hoàn thành",
  cancelled: "Đơn đã hủy",
};

export const BAY_COUNTRY_VI: Record<string, string> = {
  DE: "Đức",
  PL: "Ba Lan",
  FR: "Pháp",
  GB: "Anh",
  UK: "Anh",
  CZ: "Séc",
  SK: "Slovakia",
  NL: "Hà Lan",
  ES: "Tây Ban Nha",
  IT: "Ý",
  AT: "Áo",
  BE: "Bỉ",
  SE: "Thụy Điển",
  DK: "Đan Mạch",
  IE: "Ireland",
  PT: "Bồ Đào Nha",
  HU: "Hungary",
  RO: "Romania",
  CH: "Thụy Sĩ",
  NO: "Na Uy",
  FI: "Phần Lan",
  US: "Mỹ",
  CA: "Canada",
  AU: "Úc",
};

export const BAY_SERVICE_NAME_VI: Record<string, string> = {
  air: "BayOnline - Hàng khô",
  cold: "BayOnline - Đông lạnh",
  sea: "BayOnline - Đường biển",
};

const CARRIER_NAMES: Record<string, string> = { dhl: "DHL", dpd: "DPD", ups: "UPS", fedex: "FedEx" };

/** "2026-10-24T04:27:14Z" → "2026-10-24 11:27:14" (giờ Việt Nam, cùng dạng với Kango). */
function toVnTime(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 19).replace("T", " ");
}

/** Trạng thái Falco (cột "Vận chuyển") suy từ trạng thái Bay. */
export function mapBayStatus(t: Pick<BayTracking, "shipmentStatus" | "trackingStatus">): ShipmentStatus {
  const ts = t.trackingStatus ?? "";
  if (ts === "returned" || ts === "cancelled" || t.shipmentStatus === "cancelled") return "returned";
  if (t.shipmentStatus === "completed" || ts === "delivered") return "delivered";
  if (
    t.shipmentStatus === "handed_to_carrier" ||
    ["picked_up", "in_transit", "at_facility", "out_for_delivery", "available_for_pickup", "delivery_attempted", "exception"].includes(ts)
  ) {
    return "last_mile";
  }
  if (["customs_cleared", "at_destination_warehouse", "held_at_destination_warehouse"].includes(t.shipmentStatus)) {
    return "customs_released";
  }
  if (ts === "customs") return "customs_processing";
  if (t.shipmentStatus === "in_flight") return "exported";
  return "received";
}

export function bayStatusTitle(status: ShipmentStatus): string {
  return (
    {
      received: "Đã nhận",
      exported: "Đã xuất",
      customs_processing: "Đang thông quan",
      customs_released: "Đã thông quan",
      last_mile: "Đang giao",
      delivered: "Đã giao",
      returned: "Hoàn trả",
    } as Record<string, string>
  )[status] ?? "Đang xử lý";
}

export function bayTrackingToKango(
  t: BayTracking,
  shipment: Pick<BayShipment, "serviceType" | "recipient"> | null
): { kango: KangoTrackingResponse; status: ShipmentStatus } {
  const status = mapBayStatus(t);
  const cc = shipment?.recipient.address.countryCode ?? "";
  const carrierName = t.carrier.code ? (CARRIER_NAMES[t.carrier.code.toLowerCase()] ?? t.carrier.code.toUpperCase()) : "";

  // Bay trả cũ → mới; Kango (và trang tra cứu) cần mới → cũ.
  const trackings = [...t.events]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((e) => ({
      time: toVnTime(e.occurredAt),
      location: e.location ? `${e.location}${e.countryCode ? `, ${e.countryCode}` : ""}` : null,
      title:
        e.source === "bay"
          ? (BAY_EVENT_VI[e.code] ?? e.description ?? e.code) + (e.code === "package_received" && e.packageCode ? ` (${e.packageCode})` : "")
          : (e.description ?? e.code),
    }));

  // Bay không có sự kiện riêng cho chặng bay (chỉ có trạng thái in_flight) nên thêm 1 mốc để khách thấy.
  if (t.shipmentStatus === "in_flight") {
    const latest = t.events.map((e) => e.occurredAt).sort().pop();
    trackings.unshift({
      time: toVnTime(t.lastUpdatedAt && t.lastUpdatedAt > (latest ?? "") ? t.lastUpdatedAt : (latest ?? new Date().toISOString())),
      location: null,
      title: "Đang vận chuyển bằng đường hàng không",
    });
  }

  const trackingNumber = t.carrier.trackingNumber ?? "";
  return {
    status,
    kango: {
      status: 200,
      message: "",
      package_code: t.reference,
      package_tracking_code: trackingNumber,
      carrier_code: t.carrier.code ?? "",
      tracking_url: t.carrier.trackingUrl,
      trackings,
      shipment_information: {
        country: cc ? `VN -> ${cc}` : "",
        order_numbers: [
          {
            package_hawb_code: t.reference,
            package_tracking_code: trackingNumber,
            is_current: true,
            status_class: String(t.shipmentStatus),
            status: bayStatusTitle(status),
            is_returned: status === "returned",
            tracking_url: t.carrier.trackingUrl,
          },
        ],
      },
      additional_notes: {
        service: BAY_SERVICE_NAME_VI[shipment?.serviceType ?? "air"] ?? "BayOnline",
        country: BAY_COUNTRY_VI[cc] ?? cc,
        total_package: 1,
        last_mile: carrierName,
        last_mile_website: "",
        contact_information: "",
      },
    },
  };
}

/** Lấy hành trình 1 vận đơn Bay theo mã Bay (orders.awb). null nếu Bay không có mã này. */
export async function fetchBayTrackingAsKango(
  reference: string
): Promise<{ kango: KangoTrackingResponse; status: ShipmentStatus } | null> {
  try {
    const [t, s] = await Promise.all([bay.getTracking(reference), bay.getShipment(reference).catch(() => null)]);
    return bayTrackingToKango(t, s);
  } catch (err) {
    if (err instanceof BayApiError && err.status === 404) return null;
    throw err;
  }
}
