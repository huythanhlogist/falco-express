import LoginForm from "@/components/admin/LoginForm";

// Trang này trước đây được prerender TĨNH và CDN cache tới 1 năm
// (s-maxage=31536000) — mỗi lần đẩy code mới, tên file CSS/JS đổi hash,
// nhưng bản HTML cache cũ vẫn trỏ tới hash cũ đã không còn tồn tại trên
// server, khiến trang mất hết style.
//
// Ban đầu sửa bằng force-dynamic (ép render động MỌI request, không cache
// gì cả) — nhưng việc luôn phải chờ Node render lại từ đầu khiến TTFB cao
// hơn hẳn (đo thật ~530ms trên production so với gần như tức thì khi có
// cache CDN), đủ chậm để trên mạng di động, Safari vẽ HTML ra trước khi
// CSS kịp tải xong — đúng hiện tượng "chớp qua giao diện chưa có style vài
// giây" đã gặp. Đổi sang cache CÓ HẠN 30 giây (ISR) thay vì tắt hẳn: vừa
// tận dụng được cache CDN cho tuyệt đại đa số lượt truy cập (TTFB gần như
// tức thì), vừa tự làm mới trong vòng tối đa 30 giây sau mỗi lần đẩy code
// mới — thay vì treo cache sai tới 1 năm như lỗi gốc.
export const revalidate = 30;

export default function AdminLoginPage() {
  return <LoginForm />;
}
