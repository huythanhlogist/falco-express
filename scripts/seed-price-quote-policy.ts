/**
 * Seed 1 lần nội dung "Chính sách" ban đầu cho tab Báo giá — lấy từ ghi chú
 * gửi khách hiện có của Falco + thêm điều khoản đền bù mới. Chạy lại nhiều
 * lần sẽ tạo trùng — chỉ chạy đúng 1 lần lúc khởi tạo tính năng.
 *
 *   npx tsx -r dotenv/config scripts/seed-price-quote-policy.ts dotenv_config_path=.env.local
 */
import mysql from "mysql2/promise";

const ITEMS = [
  "Giá trên đã bao gồm phụ phí xăng dầu, chưa bao gồm VAT — nếu khách hàng lấy VAT, vui lòng liên hệ bộ phận kế toán Falco.",
  "Trọng lượng tính cước là trị giá lớn hơn giữa trọng lượng thực tế (gross weight) và trọng lượng quy đổi từ kích thước qua công thức DIM (dài x rộng x cao / 6000) — so sánh giữa cân nặng thực tế và trọng lượng quy đổi rồi chọn thông số lớn hơn. Lưu ý tất cả đơn hàng >20.5kg Falco sẽ làm tròn lên 1kg, ví dụ 21.2kg vẫn làm tròn cân 22kg (cả cân nặng và thể tích).",
  "Thời gian vận chuyển được hiểu là ngày làm việc, là dữ liệu tham khảo, không có tính chất cam kết. Thời gian giao hàng phụ thuộc vào nhiều yếu tố: thời tiết, hải quan…",
  "Đối với các mặt hàng dễ vỡ, hàng hóa có giá trị cao (vượt quá $100/1 lô hàng), khách hàng có thể liên hệ bộ phận kinh doanh Falco để được tư vấn mua bảo hiểm với mức bảo hiểm từ 15% tuỳ theo giá trị lô hàng do Falco thẩm định lại theo giá thị trường, với điều kiện lô hàng không vượt quá 1 tỷ đồng.",
  "Tất cả các dịch vụ phát hàng của Falco đều không bao gồm chữ ký của người nhận — Falco không cung cấp dịch vụ bao gồm chữ ký trực tiếp từ người nhận.",
  "Lúc lên đơn hàng, khách hàng vui lòng tự xác minh địa chỉ thật kỹ, công ty chúng tôi không phụ trách kiểm tra lại địa chỉ. Sau khi lô hàng xuất kho, việc thay đổi địa chỉ rất khó, hầu như không kịp thay đổi. Nếu khâu giao door chặng cuối sai địa chỉ hoặc mã bưu điện không chính xác dẫn đến lô hàng bị trả về, sửa địa chỉ, thất lạc — tất cả chi phí phát sinh và tổn thất đều do người gửi chịu trách nhiệm.",
  "Falco tuyệt đối không nhận vận chuyển các loại hàng sau: thuốc tây, bột trắng, hàng có chất dễ cháy, hàng nguy hiểm, Nicotine, hàng có áp suất nén...",
  "Trường hợp hàng hoá không được thông quan tại nước đến, Falco đền bù 200.000đ/kg và hoàn lại cước vận chuyển của lô hàng đó.",
  "Quý khách hàng, quý đại lý khi đã gửi hàng tới Falco là mặc định đã đọc hiểu và đồng ý tất cả điều khoản bên trên của Falco Express Logistics. Falco không giải quyết thêm bất kỳ khiếu nại nào khác ngoài các quy định trên. Trân trọng cảm ơn!",
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [existing] = await conn.query("SELECT COUNT(*) AS c FROM price_quote_policy_items");
  const count = (existing as { c: number }[])[0].c;
  if (count > 0) {
    console.log(`Đã có ${count} mục chính sách sẵn — bỏ qua seed để tránh trùng.`);
    await conn.end();
    return;
  }

  for (let i = 0; i < ITEMS.length; i++) {
    await conn.query("INSERT INTO price_quote_policy_items (content, position) VALUES (?, ?)", [ITEMS[i], i]);
  }
  console.log(`Đã seed ${ITEMS.length} mục chính sách.`);
  await conn.end();
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
