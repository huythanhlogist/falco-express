import LoginForm from "@/components/admin/LoginForm";

// Trang này trước đây được prerender TĨNH và CDN cache tới 1 năm
// (s-maxage=31536000) — mỗi lần đẩy code mới, tên file CSS/JS đổi hash,
// nhưng bản HTML cache cũ vẫn trỏ tới hash cũ đã không còn tồn tại trên
// server, khiến trang mất hết style. Ép render động để luôn lấy đúng bản
// HTML mới nhất, khớp đúng file CSS/JS hiện có. (Export này chỉ có hiệu
// lực khi khai báo ở file Server Component — vì vậy tách phần "use client"
// ra component riêng thay vì để chung trong page.tsx.)
export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return <LoginForm />;
}
