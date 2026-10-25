import CtvLoginForm from "@/components/ctv/CtvLoginForm";

// ISR ngắn thay vì force-dynamic — tránh TTFB cao gây "chớp giao diện chưa
// có style" trên mạng di động, giống lý do đã sửa cho /admin/login (xem
// ghi chú chi tiết ở đó), đồng thời vẫn tự làm mới nhanh sau mỗi lần đẩy
// code mới thay vì cache cứng.
export const revalidate = 30;

export default function CtvLoginPage() {
  return <CtvLoginForm />;
}
