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
  {
    slug: "ddp-la-gi-gui-hang-quoc-te-tron-goi-thue-hai-quan",
    title:
      "DDP là gì? Vì sao gửi quà, đồ dùng cho người thân ở nước ngoài nên chọn dịch vụ lo trọn thuế, hải quan",
    metaTitle: "DDP là gì trong gửi hàng quốc tế? | Falco Express",
    metaDescription:
      "DDP và DAP/DDU khác nhau ở chỗ ai trả thuế nhập khẩu khi hàng đến nơi. Tìm hiểu vì sao chọn đúng hình thức giúp người nhận ở Anh, Đức, Pháp... không bị bất ngờ vì phí phát sinh khi nhận hàng.",
    excerpt:
      "Rất nhiều người chỉ biết mình phải trả thêm phí hải quan khi bưu tá đã đứng trước cửa. DDP và DAP/DDU khác nhau ở đúng chỗ này — hiểu rõ trước khi gửi giúp người nhận đỡ bất ngờ, đỡ mất thời gian.",
    publishedAt: "2026-09-21",
    content: [
      {
        type: "p",
        text: "Một tình huống khá phổ biến: người thân ở Anh, Đức, Pháp... nhận được tin nhắn từ bưu tá hoặc hải quan báo phải đóng thêm một khoản phí mới được nhận hàng — dù người gửi ở Việt Nam đã trả tiền cước đầy đủ. Đây không phải lỗi của bên vận chuyển, mà là do hình thức khai hải quan của lô hàng đó thuộc loại người nhận tự trả thuế. Bài viết này giải thích sự khác nhau giữa hai hình thức phổ biến, để bạn biết cần hỏi gì trước khi gửi.",
      },
      {
        type: "h2",
        text: "DDP và DAP/DDU khác nhau ở điểm nào?",
      },
      {
        type: "list",
        items: [
          "DDP (Delivered Duty Paid — giao hàng đã trả thuế): đơn vị vận chuyển/người gửi đã tính và nộp thuế nhập khẩu, VAT, phí thông quan từ trước. Người nhận chỉ việc nhận hàng, không phải trả thêm khoản nào.",
          "DAP / DDU (Delivered At Place / Delivered Duty Unpaid — giao hàng, thuế chưa trả): hàng được giao tới địa chỉ nhận, nhưng thuế nhập khẩu và phí thông quan (nếu có) do người nhận tự đóng trực tiếp cho hải quan hoặc bưu tá khi nhận hàng.",
        ],
      },
      {
        type: "note",
        text: "DDU là cách gọi quen thuộc trong ngành chuyển phát, tuy không còn là thuật ngữ Incoterms chính thức (đã được thay bằng DAP từ năm 2010) nhưng vẫn được nhiều đơn vị vận chuyển và khách hàng dùng với cùng ý nghĩa: người nhận tự lo phần thuế.",
      },
      {
        type: "h2",
        text: "Vì sao hình thức này quan trọng với hàng gửi cho cá nhân?",
      },
      {
        type: "p",
        text: "Khi gửi quà, thực phẩm, đồ dùng cho người thân, du học sinh ở nước ngoài, người nhận thường không rành thủ tục hải quan tại nước sở tại. Nếu lô hàng đi theo hình thức DAP/DDU và vượt ngưỡng miễn thuế hàng cá nhân của nước nhận, người nhận có thể phải tự liên hệ hải quan, tự đóng phí, thậm chí hàng bị giữ tại kho vài ngày cho tới khi hoàn tất — gây bất tiện và đôi khi phát sinh thêm phí lưu kho.",
      },
      {
        type: "p",
        text: "Với hình thức DDP, toàn bộ phần này được xử lý trước ở đầu gửi, người nhận chỉ cần ký nhận — phù hợp hơn khi người nhận là người lớn tuổi, không quen thủ tục giấy tờ, hoặc chỉ đang ở nước ngoài ngắn hạn (du học sinh, người mới sang).",
      },
      {
        type: "h2",
        text: "3 câu nên hỏi trước khi gửi để tránh bất ngờ",
      },
      {
        type: "list",
        items: [
          "Cước phí đã bao gồm thuế nhập khẩu và phí thông quan ở đầu nhận chưa, hay người nhận sẽ phải trả thêm?",
          "Nếu lô hàng vượt ngưỡng miễn thuế của nước nhận, ai là người đứng ra khai và nộp thuế?",
          "Nếu hàng bị giữ ở hải quan để kiểm tra, đơn vị vận chuyển có hỗ trợ xử lý hay người nhận phải tự liên hệ?",
        ],
      },
      {
        type: "h2",
        text: "Falco Express xử lý phần thủ tục hải quan như thế nào?",
      },
      {
        type: "p",
        text: "Với dịch vụ chuyển phát quốc tế, Falco Express hỗ trợ trọn gói thủ tục hải quan và chứng từ xuất khẩu ngay từ đầu gửi tại Việt Nam — khách gửi chỉ cần đóng gói và khai đúng, đủ giá trị hàng hoá, đội ngũ Falco lo phần chứng từ và thủ tục còn lại. Ngưỡng miễn thuế hàng cá nhân khác nhau theo từng nước (ví dụ EU, Anh) đã được Falco tổng hợp riêng trong phần Hỏi–đáp hải quan ở từng trang tuyến (Đức, Anh, Pháp, Hà Lan, Séc, Ba Lan).",
      },
      {
        type: "note",
        text: "Ngưỡng miễn thuế và quy định thông quan có thể thay đổi theo thời gian và khác nhau theo loại hàng, giá trị khai báo của từng lô hàng cụ thể. Nội dung bài viết mang tính tham khảo chung, không phải tư vấn thuế/hải quan chính thức. Trước khi gửi, hãy nhắn Zalo hoặc gọi hotline Falco Express để được kiểm tra cụ thể cho lô hàng của bạn, tránh phát sinh chi phí ngoài dự kiến cho người nhận.",
      },
    ],
  },
  {
    slug: "hang-cam-hang-han-che-khi-gui-di-chau-au-va-anh",
    title:
      "Gửi hàng đi Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan: hàng gì bị cấm hoặc hạn chế, ngoài thực phẩm?",
    metaTitle: "Hàng cấm, hàng hạn chế khi gửi đi châu Âu & Anh | Falco Express",
    metaDescription:
      "Pin lithium, nước hoa, hàng giả, vũ khí... là những nhóm hàng dễ bị giữ hoặc từ chối nhất khi gửi đi Anh, Đức, Pháp. Xem danh sách cụ thể trước khi đóng gói để tránh mất hàng, mất phí.",
    excerpt:
      "Không chỉ thực phẩm tươi sống mới bị giữ ở hải quan — pin sạc dự phòng, nước hoa, hàng giả hay đồ cổ cũng là những nhóm hàng rất dễ gặp rắc rối. Danh sách cụ thể để kiểm tra trước khi đóng gói.",
    publishedAt: "2026-09-28",
    content: [
      {
        type: "p",
        text: "Nhiều khách hỏi Falco Express không chỉ về thực phẩm mà còn về pin sạc dự phòng, nước hoa, mỹ phẩm, hàng xách tay, đồ cổ... \"gửi được không?\". Câu trả lời phụ thuộc vào việc mặt hàng đó bị cấm hoàn toàn theo luật hải quan nước đến, hay chỉ bị hạn chế và cần khai báo/đóng gói đúng cách. Phân biệt rõ hai nhóm này trước khi đóng gói giúp bạn tránh mất hàng, mất phí kiểm tra hoặc bị trả hàng về.",
      },
      {
        type: "h2",
        text: "Nhóm hàng bị cấm hoàn toàn (theo luật hải quan nước đến)",
      },
      {
        type: "p",
        text: "Lấy ví dụ từ danh mục hàng cấm nhập khẩu chính thức của Vương quốc Anh (gov.uk, cập nhật 09/2026) — các nhóm hàng dưới đây bị cấm tuyệt đối, không có ngoại lệ cho hàng cá nhân/quà tặng:",
      },
      {
        type: "list",
        items: [
          "Hàng giả, hàng nhái vi phạm quyền sở hữu trí tuệ (nhãn hiệu, bản quyền)",
          "Ma tuý, chất kích thích, dược phẩm thuộc danh mục kiểm soát không có giấy phép nhập khẩu",
          "Vũ khí, đạn dược, súng/vũ khí giả giống thật, mìn sát thương",
          "Sản phẩm từ động vật, thực vật quý hiếm thuộc danh mục CITES (ngà voi, một số loại lông thú, mai rùa...) nếu không có giấy phép đặc biệt",
          "Ấn phẩm khiêu dâm, phản cảm theo quy định pháp luật nước sở tại",
        ],
      },
      {
        type: "note",
        text: "Đây là ví dụ theo danh mục của Anh — Đức, Pháp, Hà Lan, Séc, Ba Lan (đều thuộc EU) có khung pháp lý về hàng giả, vũ khí, CITES tương tự nhau ở mức độ chung, nhưng danh mục chi tiết và mức xử phạt có thể khác nhau theo từng nước. Không nên suy ra một mặt hàng được phép ở nước này thì cũng được phép ở nước khác.",
      },
      {
        type: "h2",
        text: "Nhóm hàng hạn chế — không bị cấm, nhưng cần khai báo hoặc đóng gói đúng chuẩn",
      },
      {
        type: "list",
        items: [
          "Pin lithium, pin sạc dự phòng: phần lớn hãng vận chuyển hàng không hạn chế nghiêm ngặt việc gửi pin rời (không gắn liền thiết bị) do quy định an toàn hàng không, nhiều trường hợp phải khai báo riêng hoặc không nhận gửi pin tách rời",
          "Chất lỏng dễ cháy: nước hoa, sơn móng tay, một số mỹ phẩm/gel chứa cồn — cần đóng gói kín, khai đúng loại hàng, một số nước giới hạn thể tích/số lượng",
          "Thực phẩm chức năng, thuốc không kê đơn: cần khai rõ thành phần, tên hoạt chất; một số nước yêu cầu giấy tờ nếu số lượng lớn",
          "Đồ cổ, đồ có giá trị nghệ thuật/lịch sử: một số nước yêu cầu giấy tờ chứng minh nguồn gốc trước khi cho xuất/nhập khẩu",
        ],
      },
      {
        type: "note",
        text: "Phần lớn hạn chế về pin và chất lỏng dễ cháy đến từ quy định an toàn vận chuyển hàng không quốc tế (áp dụng chung cho ngành, không riêng đơn vị nào), nên gần như mọi đơn vị chuyển phát quốc tế đều áp dụng nguyên tắc tương tự — không phải điều riêng của Falco Express.",
      },
      {
        type: "h2",
        text: "Vì sao \"cứ đóng gói rồi gửi thử\" là cách dễ mất tiền nhất",
      },
      {
        type: "p",
        text: "Với hàng thuộc nhóm hạn chế, việc đóng gói xong mới phát hiện không gửi được thường dẫn tới một trong ba tình huống: hàng bị giữ lại tại kho ở Việt Nam hoặc hải quan nước đến để kiểm tra thêm (mất thời gian), phải tháo bỏ phần không hợp lệ trước khi gửi tiếp (ví dụ tháo pin rời), hoặc hàng bị trả lại người gửi — trong mọi trường hợp bạn đều mất công đóng gói và có thể mất thêm phí xử lý.",
      },
      {
        type: "h2",
        text: "Cách kiểm tra nhanh trước khi đóng gói",
      },
      {
        type: "p",
        text: "Vì danh mục hàng cấm/hạn chế khác nhau theo từng nước và có thể thay đổi theo thời gian, Falco Express luôn kiểm tra trước khi nhận đóng gói. Bạn chỉ cần nhắn Zalo hoặc gọi hotline mô tả loại hàng và nước đến, đội ngũ Falco sẽ tư vấn miễn phí có gửi được hay không, cần khai báo gì trước khi bạn đóng gói — áp dụng cho cả hàng thực phẩm (xem bài viết riêng về thực phẩm/đặc sản) lẫn các mặt hàng khác trong bài này.",
      },
      {
        type: "note",
        text: "Thông tin trong bài viết tổng hợp từ danh mục hàng cấm/hạn chế nhập khẩu chính thức của Chính phủ Anh (gov.uk, cập nhật 09/2026) và các quy định an toàn phổ biến trong ngành vận chuyển hàng không quốc tế, mang tính tham khảo chung, không phải tư vấn pháp lý hay hải quan chính thức. Danh mục cụ thể khác nhau theo từng nước và từng lô hàng — liên hệ Falco Express hoặc cơ quan hải quan nước nhận để được tư vấn chính xác cho trường hợp của bạn.",
      },
    ],
  },
  {
    slug: "gui-do-cho-du-hoc-sinh-moi-sang-chau-au",
    title:
      "Gửi đồ cho du học sinh Việt mới sang Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan: nên chuẩn bị gì, đóng gói thế nào?",
    metaTitle: "Gửi đồ cho du học sinh mới sang châu Âu, Anh | Falco Express",
    metaDescription:
      "Sau vài tuần ổn định chỗ ở, nhiều phụ huynh muốn gửi thêm đồ cho con mới sang du học. Nên gửi gì, đóng gói ra sao, cần lưu ý gì về địa chỉ và hải quan — hướng dẫn thực tế từ Falco Express.",
    excerpt:
      "Mùa nhập học mới, sau khi con đã ổn định chỗ ở vài tuần, nhiều phụ huynh muốn gửi thêm thực phẩm, đồ dùng quen thuộc. Nên gửi gì, đóng gói thế nào để hàng đến nguyên vẹn, không vướng hải quan?",
    publishedAt: "2026-10-05",
    content: [
      {
        type: "p",
        text: "Tháng 9–10 là thời điểm nhiều du học sinh Việt Nam bắt đầu năm học mới tại Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan. Sau vài tuần đầu bận rộn làm quen chỗ ở, trường lớp, không ít phụ huynh muốn gửi thêm một gói đồ hỗ trợ con: vài món ăn quen vị, gia vị để tự nấu, hay đơn giản là vài món đồ dùng còn thiếu. Vì đây thường là lần gửi đồ đầu tiên cho một địa chỉ mới, chưa quen, nên cần chuẩn bị kỹ hơn bình thường một chút.",
      },
      {
        type: "h2",
        text: "Nhóm đồ phụ huynh thường gửi thêm sau vài tuần con ổn định chỗ ở",
      },
      {
        type: "list",
        items: [
          "Thực phẩm khô, gia vị nấu ăn quen thuộc (mì, miến, gia vị khô, nước mắm/nước tương đóng chai kín) — giúp con tự nấu ăn tiết kiệm hơn ăn ngoài, xem nhóm thực phẩm được phép gửi trong bài viết riêng về thực phẩm/đặc sản",
          "Đặc sản, bánh kẹo quê nhà đóng gói công nghiệp, hạn sử dụng rõ ràng",
          "Quần áo ấm phù hợp khí hậu lạnh hơn Việt Nam, nếu con sang vào mùa thu/đông chưa kịp mua sắm đầy đủ",
          "Vài món đồ dùng cá nhân, kỷ niệm nhỏ gọn mà con quên mang hoặc không mua được ngay ở nước sở tại",
        ],
      },
      {
        type: "h2",
        text: "Những nhóm hàng nên cân nhắc kỹ trước khi gửi kèm",
      },
      {
        type: "p",
        text: "Vì đây thường là kiện hàng gửi gấp, phụ huynh dễ gói kèm luôn những món thuộc nhóm hạn chế hoặc cấm mà không để ý. Một số nhóm cần kiểm tra lại trước khi đóng gói — đã nêu chi tiết trong bài viết riêng về hàng cấm/hạn chế:",
      },
      {
        type: "list",
        items: [
          "Pin lithium rời: sạc dự phòng, pin thay thế cho tai nghe/đèn pin — phần lớn hãng vận chuyển hàng không hạn chế nghiêm ngặt khi tách rời khỏi thiết bị",
          "Thực phẩm tươi sống, chế phẩm từ sữa và thịt (giò chả, ruốc, phô mai tự làm...) — gần như không được phép gửi vào EU và Anh dù đã cấp đông hay hút chân không",
          "Chất lỏng dễ cháy hoặc dễ rò rỉ: nước hoa, dầu gió, một số mỹ phẩm dạng gel — nếu vẫn muốn gửi, cần đóng gói kín, khai đúng loại hàng",
          "Thực phẩm chức năng, thuốc không kê đơn — cần khai rõ thành phần, tên hoạt chất, tránh gửi số lượng lớn nếu chưa hỏi trước",
        ],
      },
      {
        type: "h2",
        text: "3 nguyên tắc đóng gói để đồ đến nơi nguyên vẹn",
      },
      {
        type: "list",
        items: [
          "Tách riêng thực phẩm với quần áo, đồ điện tử trong các lớp đóng gói khác nhau, tránh mùi hoặc rò rỉ ảnh hưởng lẫn nhau khi vận chuyển dài ngày",
          "Chèn lót kỹ từng món dễ vỡ, dùng thùng đúng kích cỡ thay vì thùng quá to khiến đồ xô lệch bên trong",
          "Khai đúng và đủ nội dung, giá trị từng món trên tờ khai hải quan — không khai chung chung \"quà tặng\" cho toàn bộ kiện hàng, đặc biệt nếu có vài món giá trị cao hơn bình thường",
        ],
      },
      {
        type: "h2",
        text: "Lưu ý riêng khi người nhận là du học sinh mới sang",
      },
      {
        type: "p",
        text: "Khác với gửi cho người đã ở ổn định lâu năm, du học sinh mới sang đôi khi chưa có địa chỉ lâu dài ngay (ở tạm ký túc xá ngắn hạn, chờ chuyển phòng, chờ ký hợp đồng thuê nhà...). Trước khi gửi, nên xác nhận lại với con: địa chỉ ghi trên vận đơn có phải nơi con sẽ ở đủ lâu để nhận hàng không, số điện thoại liên hệ còn dùng được không — tránh trường hợp hàng tới nơi nhưng người nhận đã chuyển chỗ ở.",
      },
      {
        type: "note",
        text: "Vì đây thường là lần đầu con tự nhận và làm việc với hải quan nước sở tại, dịch vụ DDP (Falco Express lo trọn thuế, thủ tục hải quan từ phía Việt Nam) giúp con không phải tự đóng thêm phí hay làm thủ tục phát sinh khi nhận hàng — xem thêm trong bài viết riêng về DDP.",
      },
      {
        type: "h2",
        text: "Chưa chắc nên gửi gì hoặc đóng gói thế nào?",
      },
      {
        type: "p",
        text: "Mỗi gia đình có nhu cầu khác nhau — có nhà muốn gửi nhiều thực phẩm, có nhà ưu tiên quần áo ấm hoặc đồ dùng học tập. Bạn chỉ cần nhắn Zalo hoặc gọi hotline mô tả những món muốn gửi và nước con đang ở, đội ngũ Falco Express sẽ tư vấn miễn phí món nào gửi được, cần đóng gói ra sao trước khi bạn chuẩn bị kiện hàng.",
      },
      {
        type: "note",
        text: "Thông tin trong bài viết mang tính hướng dẫn chung dựa trên kinh nghiệm đóng gói, không phải tư vấn pháp lý hay hải quan chính thức. Quy định hàng cấm/hạn chế cụ thể theo từng nước đã nêu trong bài viết riêng — liên hệ Falco Express để được kiểm tra chính xác cho từng món hàng trước khi gửi.",
      },
    ],
  },
  {
    slug: "chuyen-do-ca-nhan-dinh-cu-chau-au-anh-ho-so-can-chuan-bi",
    title:
      "Chuyển đồ cá nhân sang châu Âu, Anh khi định cư dài hạn: khác gửi quà ngắn hạn thế nào, cần hồ sơ gì?",
    metaTitle: "Chuyển đồ cá nhân khi định cư châu Âu, Anh | Falco Express",
    metaDescription:
      "Định cư dài hạn ở Đức, Pháp, Hà Lan, Séc, Ba Lan hoặc Anh có thể được miễn thuế nhập khẩu đồ dùng cá nhân mang theo, nhưng cần đúng điều kiện và hồ sơ. Xem checklist cụ thể trước khi đóng gói.",
    excerpt:
      "Khác với gửi quà hay gửi đồ ngắn hạn, chuyển đồ cá nhân khi định cư dài hạn có một loại miễn thuế riêng (Transfer of Residence) — nhưng chỉ áp dụng nếu đúng điều kiện và có đủ hồ sơ từ trước.",
    publishedAt: "2026-10-12",
    content: [
      {
        type: "p",
        text: "Các bài viết trước của Falco Express chủ yếu nói về gửi quà, gửi đồ ăn, đồ dùng ngắn hạn cho người thân, du học sinh đang sống ở nước ngoài. Nhưng có một nhóm khách hàng khác hẳn: những người chuẩn bị định cư dài hạn — đoàn tụ gia đình, chuyển diện cư trú, ở lại làm việc lâu dài sau khi tốt nghiệp — cần chuyển cả một phần đồ đạc cá nhân, không chỉ vài món quà. Đây là nhóm hàng có quy định thuế quan khác hẳn, và nếu chuẩn bị đúng cách có thể được miễn phần lớn thuế nhập khẩu.",
      },
      {
        type: "h2",
        text: "Vì sao \"chuyển đồ định cư\" khác với \"gửi quà, gửi đồ ngắn hạn\"?",
      },
      {
        type: "p",
        text: "Gửi quà hay gửi đồ cho người đã ở sẵn nước ngoài áp dụng ngưỡng miễn thuế hàng cá nhân thông thường (đã nêu trong bài viết về DDP và từng trang tuyến riêng) — thường chỉ vài chục euro/bảng Anh mỗi lô hàng. Nhưng khi một người chuyển nơi cư trú thường xuyên từ Việt Nam sang EU hoặc Anh, pháp luật hải quan của cả khối EU và Anh có một chế độ riêng gọi là miễn thuế chuyển nơi cư trú (Transfer of Residence relief), cho phép mang theo đồ dùng cá nhân đã sở hữu từ trước mà không phải nộp thuế nhập khẩu — với điều kiện đúng quy định và có hồ sơ chứng minh.",
      },
      {
        type: "h2",
        text: "Điều kiện chung tại EU (áp dụng cho Đức, Pháp, Hà Lan, Séc, Ba Lan)",
      },
      {
        type: "p",
        text: "Theo Quy định (EC) số 1186/2009 của Liên minh châu Âu về miễn thuế hải quan, một người chuyển nơi cư trú thường xuyên từ nước ngoài EU (như Việt Nam) vào EU có thể được miễn thuế nhập khẩu cho đồ dùng cá nhân nếu đáp ứng các điều kiện sau:",
      },
      {
        type: "list",
        items: [
          "Đã sở hữu và sử dụng các đồ vật không tiêu hao (đồ nội thất, vật dụng cá nhân...) tối thiểu 6 tháng trước khi rời Việt Nam",
          "Đã cư trú liên tục ngoài EU tối thiểu 12 tháng trước khi chuyển sang",
          "Phải khai báo nhập khẩu đồ đạc trong vòng 12 tháng kể từ khi bắt đầu cư trú tại EU — có thể nhập một lần hoặc chia làm nhiều đợt",
          "Trong 12 tháng sau khi khai báo, không được bán, cho mượn, cho thuê hoặc chuyển nhượng đồ đã miễn thuế nếu chưa thông báo trước cho hải quan — nếu vi phạm sẽ bị truy thu thuế theo mức tại thời điểm đó",
        ],
      },
      {
        type: "note",
        text: "Rượu, thuốc lá, phương tiện vận tải dùng cho mục đích thương mại không thuộc diện miễn thuế này. Dụng cụ, thiết bị cá nhân phục vụ nghề nghiệp (ví dụ máy tính, dụng cụ hành nghề) thường vẫn được tính vào diện miễn thuế.",
      },
      {
        type: "h2",
        text: "Điều kiện riêng tại Anh (UK) — hồ sơ ToR1",
      },
      {
        type: "p",
        text: "Tại Anh, người chuyển nơi cư trú cần nộp đơn xin miễn thuế chuyển cư trú (Transfer of Residence relief, mẫu ToR1) trực tuyến với Hải quan Anh (HMRC) trước khi hàng được thông quan — có thể nộp trước cả khi hàng được gửi đi. Hồ sơ cần chuẩn bị:",
      },
      {
        type: "list",
        items: [
          "Danh sách đồ đạc: liệt kê theo nhóm (ví dụ: sách, bát đĩa, quần áo...), ước lượng số lượng — không cần ghi giá trị hay thương hiệu từng món, không cần chụp ảnh riêng từng món",
          "Trang hộ chiếu có ảnh của người nộp đơn",
          "Giấy tờ chứng minh địa chỉ tại Anh trong vòng 3 tháng gần nhất (sao kê ngân hàng, hoá đơn điện nước, hợp đồng thuê/mua nhà) — nếu chưa có địa chỉ cố định, có thể dùng giấy tờ của người sẽ ở cùng hoặc bằng chứng chỗ ở tạm thời",
          "Giấy tờ chứng minh địa chỉ cũ ở Việt Nam trong vòng 6 tháng gần nhất",
          "Nếu có mang theo thú cưng: giấy chứng nhận sức khoẻ hoặc hộ chiếu cho từng con vật",
          "Nếu có mang theo xe: năm sản xuất, hãng, số khung (VIN), biển số, ngày đăng ký, ngày mua",
        ],
      },
      {
        type: "note",
        text: "Sau khi đơn ToR1 được chấp thuận, mã thủ tục hải quan tương ứng cần được ghi trên tờ khai nhập khẩu khi hàng tới Anh — phần này đơn vị vận chuyển/khai hải quan sẽ hỗ trợ, người nhận không cần tự làm việc trực tiếp với hải quan nếu đã uỷ quyền.",
      },
      {
        type: "h2",
        text: "Checklist nên chuẩn bị trước khi liên hệ gửi đồ",
      },
      {
        type: "list",
        items: [
          "Xác định chính xác ngày bắt đầu cư trú hợp pháp tại nước đến (ngày nhập cảnh theo diện định cư/đoàn tụ/lao động dài hạn, không phải ngày đi du lịch) — đây là mốc tính thời hạn 12 tháng được nhập đồ miễn thuế",
          "Lập danh sách đồ đạc muốn chuyển theo nhóm, ước lượng số lượng mỗi nhóm",
          "Chuẩn bị bản sao hộ chiếu, visa/giấy tờ cư trú, và giấy tờ chứng minh địa chỉ cũ tại Việt Nam, địa chỉ mới tại nước đến (nếu đã có)",
          "Với đồ đã dùng dưới 6 tháng hoặc mua ngay trước khi chuyển, nên hỏi trước — nhóm này thường không đủ điều kiện miễn thuế theo diện chuyển cư trú",
        ],
      },
      {
        type: "h2",
        text: "Falco Express hỗ trợ phần nào trong quy trình này?",
      },
      {
        type: "p",
        text: "Falco Express hỗ trợ đóng gói, vận chuyển và chuẩn bị chứng từ xuất khẩu phía Việt Nam cho đồ đạc cá nhân khi định cư dài hạn. Vì hồ sơ xin miễn thuế chuyển cư trú (như ToR1 tại Anh) do chính người định cư đứng tên nộp trực tiếp với hải quan nước đến, Falco sẽ tư vấn trước những giấy tờ cần chuẩn bị theo kinh nghiệm thực tế, nhưng không thay mặt khách làm thủ tục pháp lý về cư trú hoặc nộp đơn xin miễn thuế — phần này khách cần tự thực hiện hoặc nhờ đơn vị tư vấn di trú/hải quan chuyên trách.",
      },
      {
        type: "note",
        text: "Thông tin trong bài tổng hợp từ Quy định (EC) số 1186/2009 của Liên minh châu Âu về miễn thuế hải quan và hướng dẫn ToR1 của Chính phủ Anh (gov.uk, cập nhật 10/2026), mang tính tham khảo chung, không phải tư vấn pháp lý, thuế hay di trú chính thức. Điều kiện cụ thể có thể khác nhau theo từng trường hợp (diện cư trú, quốc gia thành viên EU tiếp nhận...) — hãy liên hệ cơ quan hải quan nước đến hoặc đơn vị tư vấn di trú để được xác nhận chính xác cho trường hợp của bạn trước khi đóng gói. Với phần vận chuyển, nhắn Zalo hoặc gọi hotline Falco Express để được tư vấn cụ thể.",
      },
    ],
  },
  {
    slug: "gui-do-gia-dung-vat-dung-cong-kenh-di-chau-au",
    title:
      "Gửi đồ gia dụng, vật dụng cồng kềnh (nồi cơm điện, máy xay, máy ép...) đi châu Âu: đóng gói sao cho an toàn, có phải đóng thuế không?",
    metaTitle: "Gửi đồ gia dụng, vật dụng cồng kềnh đi châu Âu | Falco Express",
    metaDescription:
      "Nồi cơm điện, máy xay, máy ép trái cây gửi đi Anh, Đức, Pháp có phải đóng thuế không, điện Việt Nam có dùng được bên châu Âu không, đóng gói sao để không vỡ, không bị giữ vì pin. Hướng dẫn thực tế từ Falco Express.",
    excerpt:
      "Khác với gửi quà nhỏ, một món đồ gia dụng thường vượt ngưỡng miễn thuế và bị tính thuế trên toàn bộ giá trị, không phải phần vượt. Đây là những gì cần biết trước khi gửi nồi cơm điện, máy xay, máy ép trái cây... sang châu Âu.",
    publishedAt: "2026-10-19",
    content: [
      {
        type: "p",
        text: "Không ít khách hỏi Falco có gửi được nồi cơm điện, máy xay sinh tố, máy ép trái cây hay bàn ủi hơi nước cho người thân ở nước ngoài không — thường là đồ dùng quen tay, khó mua loại tương tự ở châu Âu, hoặc đơn giản là muốn người thân có đúng món đồ quen dùng ở nhà. Đây là nhóm hàng khác hẳn với quà tặng nhỏ (thực phẩm, đồ lặt vặt) đã nói ở các bài trước: giá trị cao hơn, có pin hoặc động cơ, và dễ vỡ nếu đóng gói không đúng cách. Dưới đây là 3 điều cần biết trước khi gửi.",
      },
      {
        type: "h2",
        text: "1. Có phải đóng thuế không? Khác gì so với gửi quà nhỏ",
      },
      {
        type: "p",
        text: "Hàng gửi cho cá nhân ở EU được miễn thuế nhập khẩu và VAT nếu tổng giá trị không quá 45 euro mỗi lô, với điều kiện là quà tặng phi thương mại giữa cá nhân với cá nhân (đã nêu ở bài viết về DDP). Nhưng có một điểm quan trọng hay bị hiểu nhầm: nếu một món đồ đơn lẻ (ví dụ 1 máy ép trái cây) có giá trị vượt 45 euro, theo quy định hải quan Đức (zoll.de), món đồ đó được tính là \"không thể chia nhỏ\" — nghĩa là thuế tính trên toàn bộ giá trị món hàng, không chỉ phần vượt 45 euro. Khác với trường hợp một lô nhiều món nhỏ cộng lại vượt ngưỡng, khi đó chỉ phần vượt mới bị tính thuế.",
      },
      {
        type: "note",
        text: "Ví dụ: một máy ép trái cây trị giá 80 euro gửi dạng quà cho cá nhân sẽ bị tính thuế trên toàn bộ 80 euro (vì là 1 món không chia nhỏ được), không phải chỉ phần 35 euro vượt ngưỡng. Mức thuế cụ thể tuỳ loại hàng và nước nhận — Falco sẽ báo trước nếu lô hàng có khả năng phát sinh thuế để khách chủ động quyết định.",
      },
      {
        type: "h2",
        text: "2. Điện Việt Nam có dùng được ở châu Âu không? Có cần đổi phích cắm?",
      },
      {
        type: "p",
        text: "Việt Nam dùng điện 220V, tần số 50Hz. Châu Âu lục địa (Đức, Pháp, Hà Lan, Séc, Ba Lan) dùng 230V/50Hz, còn Anh dùng khoảng 230V/50Hz nhưng ổ cắm khác hẳn. Vì mức điện áp khá gần nhau (220V và 230V), phần lớn đồ gia dụng hiện nay (có ghi trên nhãn máy dải điện áp \"220-240V~50/60Hz\") dùng được bình thường ở châu Âu mà không cần bộ đổi điện (converter) — chỉ cần đổi đầu phích cắm (adapter). Tuy nhiên luôn kiểm tra nhãn thông số kỹ thuật dưới đáy máy trước khi gửi: nếu máy chỉ ghi đúng 220V (không có dải 220-240V) hoặc là hàng xách tay từ nước dùng điện 110-120V, nên hỏi Falco trước khi gửi để tránh rủi ro khi dùng.",
      },
      {
        type: "list",
        items: [
          "Đức, Hà Lan: ổ cắm Type F (2 chân tròn, có tiếp đất 2 bên) — phích Việt Nam (Type A/C) cắm được vào ổ Type F nếu là phích tròn 2 chân, nhưng nên dùng adapter để chắc chắn và an toàn",
          "Pháp, Séc, Ba Lan: ổ cắm Type E (2 chân tròn, có chấu tiếp đất nhô ra) — cần adapter phù hợp, không phải loại adapter dùng cho Đức/Hà Lan luôn vừa khít",
          "Anh: ổ cắm Type G (3 chân vuông) — khác hẳn Việt Nam và toàn bộ châu Âu lục địa, bắt buộc phải có adapter riêng cho Anh",
        ],
      },
      {
        type: "h2",
        text: "3. Đóng gói đồ có pin hoặc động cơ sao cho an toàn, không bị giữ ở hải quan",
      },
      {
        type: "p",
        text: "Đồ gia dụng có động cơ (máy xay, máy ép) hoặc pin sạc (một số bàn ủi, máy hút bụi cầm tay) cần đóng gói kỹ hơn đồ thường — vừa để hàng không vỡ khi vận chuyển, vừa để không bị giữ lại kiểm tra vì khai báo không rõ ràng.",
      },
      {
        type: "list",
        items: [
          "Giữ nguyên hộp gốc của máy nếu còn — hộp gốc đã được thiết kế vừa khít, chống va đập tốt hơn hộp tự đóng",
          "Nếu không còn hộp gốc, bọc riêng phần lưỡi dao, cối thuỷ tinh/nhựa bằng xốp hơi, chèn kín khoảng trống trong thùng để máy không xê dịch khi vận chuyển",
          "Pin rời (không gắn liền máy) cần được bảo vệ cực pin (dán băng keo lên 2 đầu cực hoặc để trong vỏ gốc), không để pin rời lẫn trong hành lý — pin lắp sẵn trong máy thường ít bị hạn chế hơn pin rời",
          "Khai báo đúng tên hàng và số lượng thực tế khi gửi — khai sai hoặc khai chung chung (ví dụ chỉ ghi \"đồ gia dụng\") dễ khiến hải quan nước nhận mở kiểm tra, làm chậm thời gian giao hàng",
        ],
      },
      {
        type: "h2",
        text: "Falco Express hỗ trợ gì cho nhóm hàng này?",
      },
      {
        type: "p",
        text: "Falco tư vấn trước cho khách nếu món hàng có khả năng phát sinh thuế theo giá trị khai báo thực tế, hỗ trợ đóng gói đồ có động cơ/pin đúng tiêu chuẩn vận chuyển quốc tế, và khai báo hải quan đúng với giá trị và tên hàng thực tế — Falco không khai thấp hơn giá trị thật để né thuế, vì đây là rủi ro pháp lý cho cả người gửi và người nhận nếu bị phát hiện.",
      },
      {
        type: "note",
        text: "Thông tin về ngưỡng miễn thuế quà tặng cá nhân tham khảo từ trang hải quan Đức (zoll.de, mục Gifts, cập nhật 2026); thông tin điện áp/ổ cắm tổng hợp từ các nguồn tham khảo quốc tế về tiêu chuẩn điện lưới (worldstandards.eu và các nguồn du lịch uy tín). Mức thuế, ngưỡng miễn thuế cụ thể có thể thay đổi theo từng nước và từng thời điểm — đây là thông tin tham khảo chung, không phải tư vấn thuế chính thức. Nhắn Zalo hoặc gọi hotline Falco Express để được báo giá và tư vấn cụ thể cho từng món hàng.",
      },
    ],
  },
];

export function getBlogPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
