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
];

export function getBlogPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
