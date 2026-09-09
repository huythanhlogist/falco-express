import { redirect } from "next/navigation";

// Đây là start_url của admin-manifest.json — mỗi lần mở app từ màn hình
// chính đều chạy qua route này đầu tiên. Ép render động để không bao giờ
// bị CDN cache lại 1 bản redirect cũ (đúng lỗi đã từng gặp và sửa ở trang
// /admin/login trước đây — nhưng route này khi đó chưa được sửa theo).
export const dynamic = "force-dynamic";

export default function AdminIndexPage() {
  redirect("/admin/orders");
}
