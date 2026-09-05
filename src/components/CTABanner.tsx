import Link from "next/link";
import Reveal from "@/components/Reveal";
import { SITE } from "@/lib/constants";
import { ArrowRightIcon, PhoneIcon } from "@/components/icons";

export default function CTABanner() {
  return (
    <section className="section pt-0">
      <div className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] bg-falco-gradient-diag px-6 py-14 text-center sm:rounded-[32px] sm:px-14 sm:py-16">
            <div
              className="absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
              aria-hidden
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl">
                Sẵn sàng gửi hàng cùng Falco Express?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm text-white/85 sm:text-base">
                Liên hệ ngay để được tư vấn giải pháp vận chuyển phù hợp và
                báo giá nhanh chóng cho lô hàng của bạn.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/lien-he"
                  className="btn bg-white text-flame-700 shadow-lg hover:brightness-105"
                >
                  Liên hệ ngay
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <a href={SITE.hotlineHref} className="btn-ghost-light">
                  <PhoneIcon className="h-4 w-4" />
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
