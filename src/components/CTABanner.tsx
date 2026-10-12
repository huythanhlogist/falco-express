import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { SITE } from "@/lib/constants";

export default function CTABanner() {
  return (
    <section className="lp-section pt-0">
      <div className="lp-container">
        <Reveal>
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
                  Sẵn sàng gửi hàng cùng Falco Express?
                </h2>
                <p className="text-[15px] text-[#dce2ec] sm:text-[17px]">
                  Liên hệ ngay để được tư vấn giải pháp vận chuyển phù hợp và báo giá nhanh chóng cho
                  lô hàng của bạn.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:gap-3">
                <Link href="/lien-he" className="lp-btn-accent min-h-[52px] sm:px-7 sm:text-base">
                  Liên hệ ngay →
                </Link>
                <a href={SITE.hotlineHref} className="lp-btn-white min-h-[52px] sm:px-7 sm:text-base">
                  {SITE.hotline}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
