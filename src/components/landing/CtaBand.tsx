import Image from "next/image";
import { ZALO_HREF } from "@/lib/landing-content";

// Nội dung theo mùa (Tết) — đổi tiêu đề/mô tả ở đây khi hết mùa.
export default function CtaBand() {
  return (
    <section className="lp-container">
      <div className="relative isolate overflow-hidden bg-falco-navy-dark px-5 py-12 text-white sm:px-8 sm:py-14 lg:px-12 lg:py-16">
        <Image
          src="/images/landing/hero-port.webp"
          alt=""
          fill
          sizes="(min-width: 1280px) 1240px, 100vw"
          className="-z-20 object-cover object-[70%_85%]"
        />
        <div
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,18,32,0.92)_0%,rgba(11,18,32,0.7)_60%,rgba(234,39,4,0.3)_100%)]"
          aria-hidden
        />
        <div className="flex flex-wrap items-center justify-between gap-7">
          <div className="max-w-[620px]">
            <h2 className="mb-2.5 text-2xl font-extrabold leading-[1.15] tracking-[-0.025em] sm:text-[32px] lg:text-[40px]">
              Gửi quà Tết sớm cho người thân ở Châu Âu
            </h2>
            <p className="text-[15px] text-[#dce2ec] sm:text-[17px]">
              Chốt lịch gửi sớm để hàng về kịp trước Tết. Tư vấn miễn phí, báo giá nhanh.
            </p>
          </div>
          <a
            href={ZALO_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="lp-btn-accent min-h-[52px] w-full text-sm uppercase tracking-wide sm:w-auto sm:px-7 sm:text-base sm:normal-case sm:tracking-normal"
          >
            Nhắn Zalo ngay <span className="hidden sm:inline">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
