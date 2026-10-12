import Image from "next/image";
import Link from "next/link";

import { ZALO_HREF } from "@/lib/landing-content";

const CHECKS = ["Hải quan trọn gói", "Giao tận nhà", "Theo dõi vận đơn 24/7"];

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-falco-navy-dark text-white">
      <Image
        src="/images/landing/hero-port.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,18,32,0.9)_0%,rgba(11,18,32,0.62)_50%,rgba(11,18,32,0.15)_100%)] max-lg:bg-[linear-gradient(180deg,rgba(11,18,32,0.78)_0%,rgba(11,18,32,0.72)_100%)]"
        aria-hidden
      />

      <div className="lp-container pb-[84px] pt-10 sm:pb-[120px] sm:pt-[72px] lg:pb-[150px] lg:pt-[110px]">
        <div className="max-w-[680px]">
          <p className="lp-eyebrow lp-eyebrow-soft lp-eyebrow-line mb-3.5 sm:mb-[22px] sm:text-sm">
            Việt Nam → Châu Âu &amp; Anh
          </p>
          <h1 className="mb-3.5 text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] sm:mb-5 sm:text-5xl sm:leading-[1.08] lg:text-[60px] lg:leading-[1.06] lg:tracking-[-0.03em]">
            Gửi hàng, thực phẩm &amp; quà về tận tay người thân
          </h1>
          <p className="mb-6 max-w-[560px] text-[15px] leading-relaxed text-[#dce2ec] sm:mb-8 sm:text-[19px] sm:leading-[1.6]">
            Đóng gói chuẩn hải quan, giao tận nhà tại Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan. Báo giá
            trong 15 phút qua Zalo.
          </p>

          <div className="mb-9 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
            <a
              href={ZALO_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-accent min-h-[52px] text-sm uppercase tracking-wide shadow-[0_10px_24px_rgba(217,42,10,0.35)] sm:px-7 sm:text-base sm:normal-case sm:tracking-normal"
            >
              <span className="sm:hidden">Nhắn Zalo báo giá</span>
              <span className="hidden sm:inline">Nhắn Zalo báo giá →</span>
            </a>
            <Link
              href="#tuyen-pho-bien"
              className="lp-btn-white min-h-[52px] text-sm uppercase tracking-wide sm:px-7 sm:text-base sm:normal-case sm:tracking-normal"
            >
              Xem bảng giá
            </Link>
          </div>

          <ul className="hidden flex-wrap gap-x-[26px] gap-y-2.5 text-[15px] text-[#e6eaf1] sm:flex">
            {CHECKS.map((text) => (
              <li key={text} className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff9a3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
