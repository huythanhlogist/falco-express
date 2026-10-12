import { PhoneIcon } from "@/components/icons";
import { SITE } from "@/lib/constants";

/**
 * Nút gọi nhanh nổi cạnh widget Zalo OA (widget Zalo tự vẽ nút chat riêng
 * ở góc phải dưới) — đặt lệch lên trên để không đè lên nhau. Chỉ hiện từ
 * tablet trở lên: trên mobile đã có thanh liên hệ dính đáy (StickyContactBar).
 */
export default function FloatingHotlineButton() {
  return (
    <a
      href={SITE.hotlineHref}
      aria-label={`Gọi hotline ${SITE.hotline}`}
      title={`Gọi hotline ${SITE.hotline}`}
      className="fixed bottom-[108px] right-4 z-40 hidden h-14 w-14 items-center justify-center bg-falco-accent text-white shadow-lg transition-colors hover:bg-falco-accent-dark md:flex sm:right-6"
    >
      <PhoneIcon className="h-6 w-6" />
    </a>
  );
}
