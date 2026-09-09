export const SITE = {
  name: "FALCO EXPRESS",
  fullName: "Falco Express Logistics",
  tagline: "Kết nối giá trị – Giao hàng tận tâm",
  description:
    "Falco Express – chuyên gửi hàng hoá đi quốc tế. Nhanh – an toàn – minh bạch.",
  hotline: "0383 700 663",
  hotlineHref: "tel:0383700663",
  zaloHref: "https://zalo.me/3226148571097798462",
  zaloOAId: "3226148571097798462",
  email: "info@falcoexpress.vn",
};

/**
 * Số tư vấn báo giá riêng, chỉ dùng trên thẻ giá xuất ra ở tab admin "Báo
 * giá" (nội bộ, không public) — KHÁC với `SITE.hotline` đang hiển thị trên
 * web công khai, vì đây là số nhân viên (Thuỷ) phụ trách chốt giá trực
 * tiếp với khách.
 */
export const PRICE_QUOTE_CONTACT = {
  name: "Thuỷ",
  phone: "0867 615385",
  phoneHref: "tel:0867615385",
  // Zalo cá nhân mở qua số điện thoại (định dạng zalo.me chuẩn: 84 + số bỏ
  // số 0 đầu) — không có sẵn link OA riêng như SITE.zaloHref.
  zaloHref: "https://zalo.me/84867615385",
};

export const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/gioi-thieu", label: "Giới thiệu" },
  { href: "/dich-vu", label: "Dịch vụ" },
  { href: "/tra-cuu-van-don", label: "Tra cứu vận đơn" },
  { href: "/lien-he", label: "Liên hệ" },
];

export type Branch = {
  code: string;
  city: string;
  name: string;
  address: string;
  mapQuery: string;
};

export const BRANCHES: Branch[] = [
  {
    code: "HN",
    city: "Hà Nội",
    name: "Chi nhánh Hà Nội",
    address: "Số 4 Quần Ngựa, Ba Đình, Hà Nội",
    mapQuery: "4 Quần Ngựa, Ba Đình, Hà Nội",
  },
  {
    code: "HCM",
    city: "TP. Hồ Chí Minh",
    name: "Chi nhánh TP. Hồ Chí Minh",
    address: "3/9 Đồ Sơn, Phường 4, Tân Bình, TP. Hồ Chí Minh",
    mapQuery: "3/9 Đồ Sơn, Tân Bình, TP. Hồ Chí Minh",
  },
  {
    code: "NA",
    city: "Nghệ An",
    name: "Chi nhánh Nghệ An",
    address: "Xã Diễn Thọ, Diễn Châu, Nghệ An",
    mapQuery: "Diễn Thọ, Diễn Châu, Nghệ An",
  },
];

export type Service = {
  slug: string;
  title: string;
  short: string;
  description: string;
  bullets: string[];
  icon: "domestic" | "international" | "cargo" | "warehouse";
};

export const SERVICES: Service[] = [
  {
    slug: "chuyen-phat-noi-dia",
    title: "Chuyển phát nhanh nội địa",
    short: "Giao hàng toàn quốc, nhanh chóng và đúng hẹn.",
    description:
      "Mạng lưới vận chuyển phủ khắp các tỉnh thành, đảm bảo hàng hoá được lấy và giao trong thời gian ngắn nhất, kèm theo dõi hành trình minh bạch từng chặng.",
    bullets: [
      "Lấy hàng tận nơi trong ngày",
      "Giao nhanh 1–3 ngày tuỳ khu vực",
      "Theo dõi trạng thái đơn hàng theo thời gian thực",
      "Hỗ trợ thu hộ COD",
    ],
    icon: "domestic",
  },
  {
    slug: "chuyen-phat-quoc-te",
    title: "Chuyển phát nhanh quốc tế",
    short: "Gửi hàng, thực phẩm và quà từ Việt Nam sang Châu Âu, Anh cho người Việt xa xứ.",
    description:
      "Falco Express chuyên nhận gửi hàng từ Việt Nam sang Châu Âu và Vương quốc Anh — phục vụ đúng nhu cầu của cộng đồng người Việt: gửi thực phẩm khô, đặc sản quê nhà, quà và đồ dùng cá nhân cho người thân đang sinh sống, học tập tại Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan và nhiều nước Châu Âu khác. Đội ngũ Falco lo trọn thủ tục hải quan, khách chỉ cần đóng gói và gửi.",
    bullets: [
      "Nhận gửi thực phẩm khô, đặc sản, quà cho người Việt tại Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan...",
      "Hỗ trợ trọn gói thủ tục hải quan, chứng từ xuất khẩu",
      "Tư vấn đóng gói đúng quy định để hàng thông quan thuận lợi",
      "Cập nhật hành trình vận đơn xuyên suốt tới tận tay người nhận",
    ],
    icon: "international",
  },
  {
    slug: "van-chuyen-hang-hoa",
    title: "Vận chuyển hàng hóa",
    short: "Giải pháp vận tải hàng hoá khối lượng lớn, đa dạng loại hình.",
    description:
      "Đáp ứng nhu cầu vận chuyển hàng hoá từ kiện nhỏ đến lô hàng lớn, đa dạng phương thức đường bộ, đường biển và đường hàng không theo yêu cầu khách hàng.",
    bullets: [
      "Vận chuyển đường bộ, đường biển, đường hàng không",
      "Đóng gói và bảo hiểm hàng hoá theo yêu cầu",
      "Phù hợp cho hàng dự án, hàng cồng kềnh",
      "Đội ngũ điều phối giàu kinh nghiệm",
    ],
    icon: "cargo",
  },
  {
    slug: "kho-van-phan-phoi",
    title: "Kho vận & phân phối",
    short: "Lưu trữ, xử lý và phân phối hàng hoá tối ưu.",
    description:
      "Hệ thống kho bãi chiến lược tại các chi nhánh giúp lưu trữ an toàn, xử lý đơn hàng nhanh chóng và phân phối linh hoạt tới tay người nhận.",
    bullets: [
      "Kho bãi tại Hà Nội, TP.HCM và Nghệ An",
      "Quản lý tồn kho và xử lý đơn hàng chuyên nghiệp",
      "Phân phối linh hoạt theo tuyến và khu vực",
      "Giải pháp fulfillment cho thương mại điện tử",
    ],
    icon: "warehouse",
  },
];

export const WHY_CHOOSE_US = [
  {
    title: "Uy tín",
    description:
      "Đơn vị vận chuyển được tin tưởng bởi hàng nghìn khách hàng cá nhân và doanh nghiệp.",
    icon: "shield",
  },
  {
    title: "Nhanh chóng",
    description:
      "Mạng lưới vận chuyển tối ưu giúp rút ngắn thời gian giao nhận trong nước và quốc tế.",
    icon: "bolt",
  },
  {
    title: "An toàn",
    description:
      "Quy trình đóng gói, bảo quản và vận chuyển hàng hoá chặt chẽ ở từng khâu.",
    icon: "lock",
  },
  {
    title: "Minh bạch",
    description:
      "Theo dõi hành trình đơn hàng rõ ràng, chi phí công khai, không phát sinh ẩn.",
    icon: "eye",
  },
];

export const STATS = [
  { value: "2+", label: "Năm hoạt động" },
  { value: "3", label: "Chi nhánh toàn quốc" },
  { value: "50.000+", label: "Đơn hàng đã xử lý" },
  { value: "99%", label: "Đơn giao đúng hẹn" },
];
