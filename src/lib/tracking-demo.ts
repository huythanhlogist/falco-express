export type TrackingStep = {
  title: string;
  time: string;
  location: string;
  done: boolean;
};

export type TrackingResult = {
  code: string;
  status: string;
  service: string;
  from: string;
  to: string;
  steps: TrackingStep[];
};

export const DEMO_TRACKING: Record<string, TrackingResult> = {
  FL123456789VN: {
    code: "FL123456789VN",
    status: "Đang giao hàng",
    service: "Chuyển phát nhanh nội địa",
    from: "Hà Nội",
    to: "TP. Hồ Chí Minh",
    steps: [
      { title: "Đã tiếp nhận đơn hàng", time: "03/09 08:02", location: "Chi nhánh Hà Nội", done: true },
      { title: "Đã đến kho phân loại", time: "03/09 14:20", location: "Kho Hà Nội", done: true },
      { title: "Đang vận chuyển liên tỉnh", time: "04/09 06:15", location: "Trên đường tới TP.HCM", done: true },
      { title: "Đã đến kho phân loại", time: "05/09 09:40", location: "Kho TP. Hồ Chí Minh", done: true },
      { title: "Đang giao hàng", time: "05/09 15:10", location: "Chi nhánh TP. Hồ Chí Minh", done: false },
      { title: "Giao hàng thành công", time: "", location: "", done: false },
    ],
  },
  FL987654321QT: {
    code: "FL987654321QT",
    status: "Đã thông quan, đang vận chuyển",
    service: "Chuyển phát nhanh quốc tế",
    from: "TP. Hồ Chí Minh, Việt Nam",
    to: "Singapore",
    steps: [
      { title: "Đã tiếp nhận đơn hàng", time: "01/09 09:15", location: "Chi nhánh TP. Hồ Chí Minh", done: true },
      { title: "Hoàn tất thủ tục xuất khẩu", time: "02/09 11:00", location: "Kho trung chuyển", done: true },
      { title: "Đã thông quan hải quan", time: "03/09 16:30", location: "Cửa khẩu quốc tế", done: true },
      { title: "Đang vận chuyển quốc tế", time: "04/09 10:00", location: "Trên đường tới Singapore", done: false },
      { title: "Giao hàng thành công", time: "", location: "", done: false },
    ],
  },
  FL555000111: {
    code: "FL555000111",
    status: "Giao hàng thành công",
    service: "Chuyển phát nhanh nội địa",
    from: "Nghệ An",
    to: "Hà Nội",
    steps: [
      { title: "Đã tiếp nhận đơn hàng", time: "02/09 07:40", location: "Chi nhánh Nghệ An", done: true },
      { title: "Đã đến kho phân loại", time: "02/09 13:05", location: "Kho Nghệ An", done: true },
      { title: "Đang vận chuyển liên tỉnh", time: "03/09 05:20", location: "Trên đường tới Hà Nội", done: true },
      { title: "Đang giao hàng", time: "03/09 14:00", location: "Chi nhánh Hà Nội", done: true },
      { title: "Giao hàng thành công", time: "03/09 16:45", location: "Người nhận đã ký nhận", done: true },
    ],
  },
};

export const DEMO_CODES = Object.keys(DEMO_TRACKING);
