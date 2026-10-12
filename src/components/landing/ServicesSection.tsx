import Image from "next/image";
import Link from "next/link";
import { LANDING_SERVICES } from "@/lib/landing-content";
import SectionHeading from "./SectionHeading";

export default function ServicesSection() {
  return (
    <section id="dich-vu" className="lp-container pb-10 pt-12 sm:pt-20 lg:pt-[100px]">
      <SectionHeading
        eyebrow="Dịch vụ"
        title="Gửi gì cũng được tư vấn rõ ràng"
        right={
          <Link
            href="/dich-vu"
            className="hidden border-b-2 border-falco-accent pb-1 font-bold text-falco-navy hover:opacity-80 sm:inline-block"
          >
            Xem tất cả dịch vụ →
          </Link>
        }
      />

      <div className="mt-5 grid gap-5 sm:mt-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {LANDING_SERVICES.map((item, i) => {
          // Mobile (theo thiết kế): 2 thẻ đầu có ảnh, các thẻ sau thu gọn thành dòng chữ.
          const compact = i >= 2;
          return (
            <Link
              key={item.title}
              href={item.href}
              className={`group flex flex-col bg-white sm:border sm:border-falco-border ${
                compact
                  ? "max-sm:border-l-[3px] max-sm:border-falco-accent max-sm:bg-falco-surface max-sm:px-4 max-sm:py-3"
                  : ""
              }`}
            >
              <div className={`relative h-[170px] sm:h-[190px] ${compact ? "hidden sm:block" : ""}`}>
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="pt-3.5 sm:p-[22px_22px_24px]">
                <h3
                  className={`text-[15px] font-bold text-falco-navy sm:text-[19px] ${
                    compact ? "max-sm:text-[13px] max-sm:uppercase max-sm:tracking-wide" : ""
                  }`}
                >
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm text-falco-muted sm:mb-3.5 sm:mt-2 sm:text-[15px]">{item.description}</p>
                <span className="hidden text-sm font-bold text-falco-accent group-hover:underline sm:inline">
                  Tìm hiểu thêm →
                </span>
              </div>
            </Link>
          );
        })}
        <div className="border-l-[3px] border-falco-accent bg-falco-surface px-4 py-3 sm:hidden">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-falco-navy">Trọn gói hải quan</h3>
          <p className="mt-1.5 text-sm text-falco-muted">Falco lo khai báo, bạn chỉ cần mang hàng tới.</p>
        </div>
      </div>
    </section>
  );
}
