// Dùng chung giữa danh sách đơn (chọn nhiều đơn) và form báo giá (DbnForm):
// sessionStorage của tab hiện tại, xem session-draft.ts.

// Các đơn đang được tick ở trang Đơn hàng — giữ qua phân trang/đổi bộ lọc.
export const ORDERS_SELECTION_KEY = "falco-orders-selection";

// Đơn được chuyển sang form báo giá khi bấm "Tạo báo giá"; form đọc 1 lần rồi xoá.
export const QUOTE_HANDOFF_KEY = "falco-quote-handoff";

export type QuoteHandoffOrder = {
  id: number;
  falco_code: string;
  recipient_name: string | null;
  destination: string | null;
  weight_kg: string | null;
  received_date: string | null;
};
