import { SITE } from "@/lib/constants";

export const ZALO_HREF = SITE.zaloHref;

/** 4 thẻ dịch vụ trên landing — nội dung theo thiết kế falco-redesign. */
export const LANDING_SERVICES = [
  {
    image: "/images/landing/service-food.webp",
    alt: "Thùng carton và vật liệu đóng gói",
    title: "Thực phẩm & đặc sản",
    description:
      "Đồ khô, gia vị, bánh kẹo, đồ đóng gói sẵn. Tư vấn mặt hàng được phép gửi theo từng nước.",
    href: "/dich-vu#chuyen-phat-quoc-te",
  },
  {
    image: "/images/landing/service-gifts.webp",
    alt: "Các thùng hàng đang được đóng gói",
    title: "Quà tặng & đồ cá nhân",
    description: "Quần áo, mỹ phẩm, quà Tết cho du học sinh và người lao động xa nhà.",
    href: "/dich-vu#chuyen-phat-quoc-te",
  },
  {
    image: "/images/landing/why-falco.webp",
    alt: "Tàu container tại cảng",
    title: "Hàng cho shop online",
    description: "Gửi lô định kỳ cho người bán hàng Việt ở nước ngoài, giá theo sản lượng.",
    href: "/dich-vu#van-chuyen-hang-hoa",
  },
  {
    image: "/images/landing/service-documents.webp",
    alt: "Tài liệu và thư chuyển phát quốc tế",
    title: "Tài liệu & hàng mẫu",
    description: "Hồ sơ, giấy tờ, hàng mẫu chuyển phát nhanh, có mã theo dõi.",
    href: "/dich-vu#chuyen-phat-quoc-te",
  },
];

/** Thứ tự + cờ + tên hiển thị của 6 tuyến trên landing (slug khớp COUNTRY_ROUTES). */
export const LANDING_ROUTES = [
  { slug: "anh", flag: "uk", label: "Vương quốc Anh", short: "Anh", flagAlt: "Cờ Vương quốc Anh" },
  { slug: "duc", flag: "de", label: "Đức", short: "Đức", flagAlt: "Cờ Đức" },
  { slug: "phap", flag: "fr", label: "Pháp", short: "Pháp", flagAlt: "Cờ Pháp" },
  { slug: "ha-lan", flag: "nl", label: "Hà Lan", short: "Hà Lan", flagAlt: "Cờ Hà Lan" },
  { slug: "sec", flag: "cz", label: "Séc", short: "Séc", flagAlt: "Cờ Séc" },
  { slug: "ba-lan", flag: "pl", label: "Ba Lan", short: "Ba Lan", flagAlt: "Cờ Ba Lan" },
];

/**
 * Giá khởi điểm/kg và thời gian vận chuyển theo tuyến — CHƯA có số liệu chốt
 * trong hệ thống nên để trống (thiết kế chỉ có chỗ giữ chỗ [GIÁ]/[X–Y] ngày).
 * Điền vào đây khi có số thật, vd:
 *   anh: { priceFrom: "185.000đ", transit: "5–7 ngày" }
 * Tuyến nào chưa điền sẽ hiện "Báo giá qua Zalo".
 */
export const ROUTE_PRICING: Record<string, { priceFrom?: string; transit?: string }> = {};

export const PROCESS_STEPS = [
  { title: "Nhắn Zalo", description: "Gửi ảnh hàng, cân nặng và nước nhận." },
  { title: "Nhận báo giá trọn gói", description: "Giá theo kg, đã gồm hải quan, không phát sinh." },
  { title: "Gửi hàng", description: "Mang tới chi nhánh hoặc Falco đến lấy tận nơi." },
  { title: "Theo dõi & nhận hàng", description: "Tra cứu vận đơn đến khi người thân nhận hàng." },
];

export const LANDING_FAQS = [
  {
    question: "Gửi thực phẩm Việt Nam sang Anh, Đức có được không?",
    answer:
      "Có. Falco Express nhận gửi thực phẩm khô, đặc sản, gia vị và đồ ăn đóng gói sẵn sang Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan và nhiều nước Châu Âu khác. Đội ngũ Falco sẽ tư vấn loại thực phẩm được phép gửi và cách đóng gói đúng quy định hải quan của từng nước.",
  },
  {
    question: "Gửi hàng từ Việt Nam sang Châu Âu mất bao lâu?",
    answer:
      "Tuỳ tuyến và dịch vụ, thời gian vận chuyển thường dao động vài ngày đến khoảng 1-2 tuần kể từ khi bàn giao cho đối tác vận chuyển quốc tế. Bạn có thể theo dõi hành trình đơn hàng theo thời gian thực ngay trên trang Tra cứu vận đơn.",
  },
  {
    question: "Có cần lo thủ tục hải quan không?",
    answer:
      "Không. Falco Express hỗ trợ trọn gói thủ tục hải quan và chứng từ xuất khẩu — bạn chỉ cần đóng gói hàng và cung cấp thông tin người nhận, phần còn lại đội ngũ Falco sẽ xử lý.",
  },
  {
    question: "Cước phí gửi hàng đi Châu Âu tính như thế nào?",
    answer:
      "Cước phí phụ thuộc vào cân nặng, kích thước và nước đến. Liên hệ hotline hoặc Zalo để được báo giá cụ thể và nhanh chóng cho lô hàng của bạn.",
  },
];
