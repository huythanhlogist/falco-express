// Tách riêng để component client dùng được mà không kéo theo client gọi API (server-only).
/** Nhãn ngắn tiếng Việt cho trạng thái vận đơn Bay. */
export const BAY_STATUS_LABELS: Record<string, string> = {
  agency_created: "Chờ kho nhận",
  created: "Đã tạo",
  checked: "Đã kiểm",
  weighed: "Đã cân",
  to_airport: "Ra sân bay",
  in_flight: "Đang bay",
  customs_cleared: "Đã thông quan",
  at_destination_warehouse: "Tới kho đầu cuối",
  handed_to_carrier: "Đã giao hãng nội địa",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  held_at_destination_warehouse: "Giữ tại kho",
};

/** Loại hàng/dịch vụ của vận đơn Bay (serviceType): khô, đông lạnh, đường biển. */
export const BAY_SERVICE_LABELS: Record<string, string> = {
  air: "Hàng khô",
  cold: "Đông lạnh",
  sea: "Đường biển",
};

export const BAY_SERVICE_CLASSES: Record<string, string> = {
  air: "bg-amber-50 text-amber-700",
  cold: "bg-cyan-50 text-cyan-700",
  sea: "bg-indigo-50 text-indigo-700",
};
