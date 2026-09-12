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
  // In kèm ở chân mỗi thẻ báo giá để khách nhận diện đúng web thật của
  // Falco (và tra cứu vận đơn được luôn nếu cần).
  website: "falcoexpress.com",
  websiteHref: "https://falcoexpress.com/tra-cuu-van-don",
};

export const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/gioi-thieu", label: "Giới thiệu" },
  { href: "/dich-vu", label: "Dịch vụ" },
  { href: "/tra-cuu-van-don", label: "Tra cứu vận đơn" },
  { href: "/blog", label: "Blog" },
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

export type CountryRoute = {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  heroDescription: string;
  bullets: string[];
  /** Vùng áp dụng quy định hải quan — "eu" dùng chung 1 bộ FAQ hải quan EU,
   *  "uk" dùng bộ FAQ riêng vì Anh không còn theo quy định EU sau Brexit. */
  customsRegion: "eu" | "uk";
};

/**
 * FAQ hải quan — nguồn: trang chính thức của cơ quan hải quan, tổng hợp
 * 2026-09-12. Đây là thông tin CHUNG mang tính tham khảo, không phải tư
 * vấn thuế/pháp lý — quy định có thể thay đổi và còn tuỳ từng lô hàng cụ
 * thể, khách nên liên hệ Falco hoặc hải quan sở tại để được tư vấn chính
 * xác cho trường hợp của mình.
 */
export type CustomsFaq = { question: string; answer: string };

export const EU_CUSTOMS_FAQS: CustomsFaq[] = [
  {
    question: "Gửi quà cho người thân ở Châu Âu có phải đóng thuế không?",
    answer:
      "EU miễn thuế nhập khẩu và VAT cho quà tặng cá nhân (không mang tính thương mại, người gửi không nhận lại tiền) có giá trị không quá 45 EUR, gửi không thường xuyên giữa 2 cá nhân. Một số mặt hàng như rượu, thuốc lá, cà phê, nước hoa có thêm giới hạn số lượng riêng trong định mức này. Đây là quy định chung, hải quan từng nước có thể áp dụng chi tiết khác nhau — Falco sẽ tư vấn cụ thể theo từng lô hàng.",
  },
  {
    question: "Nếu lô hàng vượt quá 45 EUR thì sao?",
    answer:
      "Phần giá trị vượt định mức miễn thuế quà tặng cá nhân có thể bị tính thuế nhập khẩu và VAT theo quy định của nước nhận. Từ giữa năm 2026, EU cũng đã bỏ mức miễn thuế nhập khẩu 150 EUR trước đây áp dụng cho các kiện hàng mua bán thương mại (khác với quà tặng cá nhân) — nên các lô hàng mang tính thương mại hoặc giá trị lớn nên hỏi Falco để được báo trước chi phí phát sinh, tránh bất ngờ khi hàng tới nơi.",
  },
  {
    question: "Loại hàng nào không nên/không được gửi sang Châu Âu?",
    answer:
      "Mỗi nước có danh mục hàng cấm/hạn chế riêng (thực phẩm tươi sống, sản phẩm động vật chưa qua xử lý, một số dược phẩm...). Falco sẽ tư vấn cụ thể theo loại hàng và nước đến trước khi bạn đóng gói, để đảm bảo hàng thông quan thuận lợi.",
  },
]; // Nguồn: taxation-customs.ec.europa.eu, zoll.de (hải quan Đức, áp dụng quy định EU)

export const UK_CUSTOMS_FAQS: CustomsFaq[] = [
  {
    question: "Gửi quà cho người thân ở Anh (UK) có phải đóng thuế không?",
    answer:
      "UK miễn VAT cho quà tặng cá nhân trị giá từ 39 GBP trở xuống, gửi giữa 2 cá nhân (không phải mua bán). Với hàng hoá nói chung (không phải quà), hàng trị giá từ 135 GBP trở xuống thường không bị tính thuế nhập khẩu. Đây là quy định chung, khách nên hỏi Falco để được tư vấn cụ thể theo lô hàng.",
  },
  {
    question: "Nếu lô hàng vượt quá định mức thì sao?",
    answer:
      "Phần giá trị vượt định mức miễn thuế có thể bị tính VAT và thuế nhập khẩu theo biểu thuế của Anh, tuỳ loại hàng. Falco sẽ báo trước nếu lô hàng của bạn có khả năng phát sinh chi phí này.",
  },
  {
    question: "Loại hàng nào không nên/không được gửi sang Anh?",
    answer:
      "Anh có danh mục hàng cấm/hạn chế riêng (thực phẩm tươi sống, một số sản phẩm động vật, dược phẩm...). Falco sẽ tư vấn cụ thể theo loại hàng trước khi bạn đóng gói.",
  },
]; // Nguồn: gov.uk/goods-sent-from-abroad

/**
 * Trang riêng theo từng nước cho tuyến Châu Âu & Anh hiện Falco đang phục
 * vụ (khớp với danh sách nước trong SERVICES/Hero) — mỗi nước 1 URL để
 * bắt đúng từ khóa tìm kiếm dạng "gửi hàng đi [nước]". Nội dung tái dùng
 * đúng cam kết thật đã có trên site (hải quan, theo dõi vận đơn, thực
 * phẩm/đặc sản/quà) — không thêm số liệu hay chi tiết hải quan riêng
 * từng nước chưa được xác nhận.
 */
export const COUNTRY_ROUTES: CountryRoute[] = [
  {
    slug: "duc",
    name: "Đức",
    metaTitle: "Gửi hàng đi Đức từ Việt Nam | Falco Express",
    metaDescription:
      "Falco Express nhận gửi thực phẩm, đặc sản, quà và đồ dùng cá nhân từ Việt Nam sang Đức cho người Việt xa xứ, du học sinh. Hỗ trợ trọn gói thủ tục hải quan, theo dõi vận đơn minh bạch.",
    heroDescription:
      "Gửi thực phẩm khô, đặc sản quê nhà và quà cho người thân, du học sinh đang sinh sống tại Đức — Falco Express lo trọn thủ tục hải quan, bạn chỉ cần đóng gói và gửi.",
    bullets: [
      "Nhận gửi thực phẩm khô, đặc sản, quà cho người Việt tại Đức",
      "Hỗ trợ trọn gói thủ tục hải quan, chứng từ xuất khẩu",
      "Tư vấn đóng gói đúng quy định để hàng thông quan thuận lợi",
      "Cập nhật hành trình vận đơn xuyên suốt tới tận tay người nhận",
    ],
    customsRegion: "eu",
  },
  {
    slug: "anh",
    name: "Anh",
    metaTitle: "Gửi hàng đi Anh (UK) từ Việt Nam | Falco Express",
    metaDescription:
      "Falco Express nhận gửi thực phẩm, đặc sản, quà và đồ dùng cá nhân từ Việt Nam sang Anh (UK) cho người Việt xa xứ, du học sinh. Hỗ trợ trọn gói thủ tục hải quan, theo dõi vận đơn minh bạch.",
    heroDescription:
      "Gửi thực phẩm khô, đặc sản quê nhà và quà cho người thân, du học sinh đang sinh sống tại Vương quốc Anh — Falco Express lo trọn thủ tục hải quan, bạn chỉ cần đóng gói và gửi.",
    bullets: [
      "Nhận gửi thực phẩm khô, đặc sản, quà cho người Việt tại Anh",
      "Hỗ trợ trọn gói thủ tục hải quan, chứng từ xuất khẩu",
      "Tư vấn đóng gói đúng quy định để hàng thông quan thuận lợi",
      "Cập nhật hành trình vận đơn xuyên suốt tới tận tay người nhận",
    ],
    customsRegion: "uk",
  },
  {
    slug: "phap",
    name: "Pháp",
    metaTitle: "Gửi hàng đi Pháp từ Việt Nam | Falco Express",
    metaDescription:
      "Falco Express nhận gửi thực phẩm, đặc sản, quà và đồ dùng cá nhân từ Việt Nam sang Pháp cho người Việt xa xứ, du học sinh. Hỗ trợ trọn gói thủ tục hải quan, theo dõi vận đơn minh bạch.",
    heroDescription:
      "Gửi thực phẩm khô, đặc sản quê nhà và quà cho người thân, du học sinh đang sinh sống tại Pháp — Falco Express lo trọn thủ tục hải quan, bạn chỉ cần đóng gói và gửi.",
    bullets: [
      "Nhận gửi thực phẩm khô, đặc sản, quà cho người Việt tại Pháp",
      "Hỗ trợ trọn gói thủ tục hải quan, chứng từ xuất khẩu",
      "Tư vấn đóng gói đúng quy định để hàng thông quan thuận lợi",
      "Cập nhật hành trình vận đơn xuyên suốt tới tận tay người nhận",
    ],
    customsRegion: "eu",
  },
  {
    slug: "ha-lan",
    name: "Hà Lan",
    metaTitle: "Gửi hàng đi Hà Lan từ Việt Nam | Falco Express",
    metaDescription:
      "Falco Express nhận gửi thực phẩm, đặc sản, quà và đồ dùng cá nhân từ Việt Nam sang Hà Lan cho người Việt xa xứ, du học sinh. Hỗ trợ trọn gói thủ tục hải quan, theo dõi vận đơn minh bạch.",
    heroDescription:
      "Gửi thực phẩm khô, đặc sản quê nhà và quà cho người thân, du học sinh đang sinh sống tại Hà Lan — Falco Express lo trọn thủ tục hải quan, bạn chỉ cần đóng gói và gửi.",
    bullets: [
      "Nhận gửi thực phẩm khô, đặc sản, quà cho người Việt tại Hà Lan",
      "Hỗ trợ trọn gói thủ tục hải quan, chứng từ xuất khẩu",
      "Tư vấn đóng gói đúng quy định để hàng thông quan thuận lợi",
      "Cập nhật hành trình vận đơn xuyên suốt tới tận tay người nhận",
    ],
    customsRegion: "eu",
  },
  {
    slug: "sec",
    name: "Séc",
    metaTitle: "Gửi hàng đi Séc từ Việt Nam | Falco Express",
    metaDescription:
      "Falco Express nhận gửi thực phẩm, đặc sản, quà và đồ dùng cá nhân từ Việt Nam sang Séc cho người Việt xa xứ, du học sinh. Hỗ trợ trọn gói thủ tục hải quan, theo dõi vận đơn minh bạch.",
    heroDescription:
      "Gửi thực phẩm khô, đặc sản quê nhà và quà cho người thân, du học sinh đang sinh sống tại Séc — Falco Express lo trọn thủ tục hải quan, bạn chỉ cần đóng gói và gửi.",
    bullets: [
      "Nhận gửi thực phẩm khô, đặc sản, quà cho người Việt tại Séc",
      "Hỗ trợ trọn gói thủ tục hải quan, chứng từ xuất khẩu",
      "Tư vấn đóng gói đúng quy định để hàng thông quan thuận lợi",
      "Cập nhật hành trình vận đơn xuyên suốt tới tận tay người nhận",
    ],
    customsRegion: "eu",
  },
  {
    slug: "ba-lan",
    name: "Ba Lan",
    metaTitle: "Gửi hàng đi Ba Lan từ Việt Nam | Falco Express",
    metaDescription:
      "Falco Express nhận gửi thực phẩm, đặc sản, quà và đồ dùng cá nhân từ Việt Nam sang Ba Lan cho người Việt xa xứ, du học sinh. Hỗ trợ trọn gói thủ tục hải quan, theo dõi vận đơn minh bạch.",
    heroDescription:
      "Gửi thực phẩm khô, đặc sản quê nhà và quà cho người thân, du học sinh đang sinh sống tại Ba Lan — Falco Express lo trọn thủ tục hải quan, bạn chỉ cần đóng gói và gửi.",
    bullets: [
      "Nhận gửi thực phẩm khô, đặc sản, quà cho người Việt tại Ba Lan",
      "Hỗ trợ trọn gói thủ tục hải quan, chứng từ xuất khẩu",
      "Tư vấn đóng gói đúng quy định để hàng thông quan thuận lợi",
      "Cập nhật hành trình vận đơn xuyên suốt tới tận tay người nhận",
    ],
    customsRegion: "eu",
  },
];
