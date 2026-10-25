import Image from "next/image";

/**
 * Next.js hiện file này NGAY LẬP TỨC (đã có sẵn CSS, không phải HTML thô)
 * trong lúc route con còn đang tải dữ liệu — dùng để tránh trường hợp màn
 * hình chớp qua trạng thái chưa có style trước khi vào được trang thật,
 * đặc biệt dễ thấy khi mở app từ màn hình chính (không có thanh địa chỉ
 * Safari che đi khoảng chờ này).
 */
export default function AdminLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-mist">
      <Image
        src="/falco-logo.png"
        alt="Falco Express"
        width={48}
        height={48}
        className="h-12 w-12 animate-pulse rounded-full ring-1 ring-line"
        priority
      />
      <p className="text-sm font-medium text-ink/50">Đang tải...</p>
    </div>
  );
}
