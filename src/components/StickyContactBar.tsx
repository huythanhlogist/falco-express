import { SITE } from "@/lib/constants";
import { PhoneIcon } from "@/components/icons";

// Thanh liên hệ dính đáy màn hình trên mobile (Gọi ngay / Zalo báo giá).
// SiteChrome chừa padding đáy cho <body> ở mobile để không che nội dung.
export default function StickyContactBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 shadow-[0_-4px_16px_rgba(11,18,32,0.15)] md:hidden">
      <a
        href={SITE.hotlineHref}
        className="flex h-14 items-center justify-center gap-2 bg-falco-navy text-sm font-bold uppercase tracking-wide text-white"
      >
        <PhoneIcon className="h-[18px] w-[18px]" />
        Gọi ngay
      </a>
      <a
        href={SITE.zaloHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-14 items-center justify-center gap-2 bg-falco-accent text-sm font-bold uppercase tracking-wide text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Zalo báo giá
      </a>
    </div>
  );
}
