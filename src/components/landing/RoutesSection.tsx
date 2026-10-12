import Image from "next/image";
import Link from "next/link";
import { LANDING_ROUTES, ROUTE_PRICING, ZALO_HREF } from "@/lib/landing-content";
import SectionHeading from "./SectionHeading";

export default function RoutesSection() {
  return (
    <section id="tuyen-pho-bien" className="lp-container pt-10 scroll-mt-24">
      <div className="bg-falco-navy px-5 py-10 text-white sm:px-8 sm:py-12 lg:px-12 lg:py-[52px]">
        <SectionHeading
          tone="dark"
          eyebrow="Tuyến phổ biến"
          title="Giá theo kg cho từng tuyến"
          right={
            <a
              href={ZALO_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-white hidden !min-h-0 !px-[22px] !py-[13px] sm:inline-flex"
            >
              Nhận báo giá chính xác
            </a>
          }
        />

        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-[34px] sm:gap-3.5 md:grid-cols-3 lg:grid-cols-4">
          {LANDING_ROUTES.map((route) => {
            const pricing = ROUTE_PRICING[route.slug];
            const detail =
              pricing?.priceFrom || pricing?.transit
                ? [pricing.priceFrom && `Từ ${pricing.priceFrom}/kg`, pricing.transit].filter(Boolean).join(" · ")
                : "Báo giá qua Zalo";
            return (
              <Link
                key={route.slug}
                href={`/gui-hang-di-${route.slug}`}
                className="group flex flex-col gap-0.5 border border-white/[0.12] border-t-[3px] border-t-falco-accent bg-white/[0.07] p-3.5 transition-colors hover:bg-white/[0.12] sm:flex-row sm:items-center sm:gap-4 sm:border-t sm:border-t-white/[0.12] sm:px-[22px] sm:py-5"
              >
                <Image
                  src={`/images/landing/flags/${route.flag}.svg`}
                  alt={route.flagAlt}
                  width={54}
                  height={36}
                  className="mb-2 h-6 w-9 shrink-0 object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.25)] sm:mb-0 sm:h-9 sm:w-[54px]"
                />
                <span className="flex-1">
                  <span className="block text-[17px] font-extrabold sm:text-lg sm:font-bold">
                    <span className="sm:hidden">{route.short}</span>
                    <span className="hidden sm:inline">{route.label}</span>
                  </span>
                  <span className="text-xs text-[#c9d1e0] sm:text-sm">{detail}</span>
                </span>
                <span aria-hidden className="hidden text-falco-accent-soft transition-transform group-hover:translate-x-0.5 sm:inline">
                  →
                </span>
              </Link>
            );
          })}
        </div>

        <a
          href={ZALO_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="lp-btn-white mt-5 w-full sm:hidden"
        >
          Nhận báo giá chính xác
        </a>
      </div>
    </section>
  );
}
