import { PhoneIcon } from "@/components/icons";
import { SITE } from "@/lib/constants";

/**
 * Nút gọi nhanh nổi cạnh widget Zalo OA (widget Zalo tự vẽ nút chat riêng
 * ở góc phải dưới) — đặt lệch lên trên để không đè lên nhau.
 */
export default function FloatingHotlineButton() {
  return (
    <a
      href={SITE.hotlineHref}
      aria-label={`Gọi hotline ${SITE.hotline}`}
      title={`Gọi hotline ${SITE.hotline}`}
      className="fixed bottom-[108px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-flame-600 text-white shadow-lg shadow-flame-600/40 transition-transform hover:scale-105 sm:right-6"
    >
      <PhoneIcon className="h-6 w-6" />
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-flame-500/50" />
    </a>
  );
}
