export type BlogContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "note"; text: string };

export type BlogPost = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  publishedAt: string;
  content: BlogContentBlock[];
};

/**
 * Nguồn dữ liệu bài blog — mỗi bài là 1 object tĩnh trong mảng này, không
 * lấy từ CMS/DB. Trang danh sách (/blog) và trang chi tiết (/blog/[slug])
 * đều generateStaticParams từ mảng này nên được prerender thành HTML tĩnh
 * ở build time, giống các trang /gui-hang-di-*.
 */
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "gui-thuc-pham-dac-san-di-chau-au-dung-cach",
    title:
      "Gửi thực phẩm, đặc sản Việt Nam đi châu Âu: loại nào gửi được, loại nào bị giữ ở hải quan?",
    metaTitle: "Gửi đồ ăn, đặc sản đi châu Âu đúng cách | Falco Express",
    metaDescription:
      "Thịt, sữa tươi hầu như không được gửi vào EU và Anh từ Việt Nam. Xem danh sách thực phẩm được gửi, bị cấm và cách đóng gói để hàng đến tay người thân ở Anh, Đức, Pháp nguyên vẹn.",
    excerpt:
      "Thịt, sữa tươi hầu như không được phép gửi vào EU và Anh từ Việt Nam — trong khi đồ khô đóng gói kín lại rất dễ đi. Danh sách cụ thể và cách đóng gói đúng để hàng đến tay người nhận nguyên vẹn.",
    publishedAt: "2026-09-12",
    content: [
      {
        type: "p",
        text: "Thực phẩm khô và đặc sản quê nhà luôn là mặt hàng được gửi nhiều nhất cho người thân, du học sinh Việt đang sống ở Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan. Nhưng đây cũng là loại hàng dễ gặp rắc rối nhất: gửi nhầm mặt hàng bị hạn chế, hàng có thể bị hải quan nước nhận giữ lại, tiêu huỷ hoặc trả về — vừa mất hàng vừa mất phí. Dưới đây là những gì bạn nên biết trước khi đóng gói.",
      },
      {
        type: "h2",
        text: "Nhóm thực phẩm hầu như KHÔNG được gửi vào EU và Anh từ Việt Nam",
      },
      {
        type: "p",
        text: "Theo quy định chung của Liên minh châu Âu (áp dụng cho Đức, Pháp, Hà Lan, Séc, Ba Lan) và Vương quốc Anh, các sản phẩm có nguồn gốc động vật gửi từ nước ngoài khối như Việt Nam tới một cá nhân gần như không được phép nhập cảnh — kể cả khi đã đóng gói kín, hút chân không hay cấp đông. Mục đích là ngăn dịch bệnh động vật lây lan qua đường thực phẩm.",
      },
      {
        type: "list",
        items: [
          "Thịt tươi, thịt đông lạnh, thịt hun khói, giò chả, ruốc thịt, xúc xích, jambon",
          "Sữa tươi, sữa bột, phô mai, bơ và các chế phẩm từ sữa",
          "Trứng và các sản phẩm chế biến từ trứng chưa qua xử lý công nghiệp",
          "Hải sản tươi sống, ốc, hàu chưa qua chế biến đóng hộp",
        ],
      },
      {
        type: "note",
        text: "EU có một vài ngoại lệ rất hẹp (ví dụ mật ong, một số loại hải sản/ốc sên tới 2kg, cá và sản phẩm cá tới 20kg theo quy định về hàng gửi cho cá nhân), và sữa bột trẻ em dưới 2kg còn nguyên bao bì thương hiệu cho nhu cầu y tế. Đây là ngưỡng tối đa được phép, không đồng nghĩa mọi lô hàng thuộc nhóm này đều được chấp nhận — Falco Express khuyến nghị không gửi các mặt hàng động vật tươi/chế biến qua đường bưu kiện cá nhân để tránh rủi ro bị giữ hoặc tiêu huỷ tại hải quan.",
      },
      {
        type: "h2",
        text: "Nhóm thực phẩm thường gửi được nếu đóng gói đúng cách",
      },
      {
        type: "list",
        items: [
          "Đồ khô đóng gói kín, hạn sử dụng dài: miến, bún khô, phở khô, mì gói",
          "Gia vị khô: tiêu, nghệ, sả bột, ớt bột; nước mắm, nước tương đóng chai kín, chống rò rỉ",
          "Bánh kẹo, đặc sản đóng gói công nghiệp có hạn dùng rõ ràng: bánh đậu xanh, mứt, kẹo dừa, cà phê, trà",
          "Đồ ăn vặt đóng gói kín: bim bim, rong biển, hạt điều, hạt sen sấy, trái cây sấy khô",
        ],
      },
      {
        type: "note",
        text: "Đây là nhóm rủi ro thấp nhưng không có nghĩa 100% được chấp nhận trong mọi trường hợp — hải quan nước nhận vẫn có thể kiểm tra ngẫu nhiên bất kỳ kiện hàng nào. Khai đúng, khai đủ nội dung trên tờ khai vẫn là yếu tố quan trọng nhất.",
      },
      {
        type: "h2",
        text: "3 nguyên tắc đóng gói để thực phẩm không hỏng, không bị giữ",
      },
      {
        type: "list",
        items: [
          "Ưu tiên hàng khô, hút chân không; hạn chế gửi chất lỏng hoặc hàng dễ vỡ nếu không thật sự cần thiết",
          "Ghi nhãn rõ ràng bằng tiếng Anh: tên sản phẩm, thành phần chính, để hải quan nước nhận dễ đối chiếu",
          "Khai đúng và đủ trên tờ khai hải quan — không khai chung chung là \"quà tặng\" cho mọi loại hàng và không khai thấp giá trị hơn thực tế, vì đây là nguyên nhân phổ biến khiến kiện hàng bị giữ lâu hơn hoặc phát sinh phí kiểm tra",
        ],
      },
      {
        type: "h2",
        text: "Chưa chắc mặt hàng của bạn có gửi được không?",
      },
      {
        type: "p",
        text: "Vì quy định hải quan khác nhau theo từng nước và có thể thay đổi theo thời gian, Falco Express luôn kiểm tra trước khi nhận đóng gói. Bạn chỉ cần nhắn Zalo hoặc gọi hotline mô tả loại hàng muốn gửi, đội ngũ Falco sẽ tư vấn miễn phí có gửi được hay không trước khi bạn mất công đóng gói.",
      },
      {
        type: "note",
        text: "Thông tin trong bài viết tổng hợp từ quy định chung của Liên minh châu Âu và Vương quốc Anh về nhập khẩu sản phẩm có nguồn gốc động vật cho mục đích cá nhân (cập nhật 09/2026), mang tính tham khảo, không phải tư vấn pháp lý hay hải quan chính thức. Quy định có thể thay đổi và khác nhau theo từng lô hàng cụ thể — liên hệ Falco Express hoặc cơ quan hải quan nước nhận để được tư vấn chính xác cho trường hợp của bạn.",
      },
    ],
  },
];

export function getBlogPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
