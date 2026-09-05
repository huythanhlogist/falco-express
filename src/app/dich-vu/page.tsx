import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import CTABanner from "@/components/CTABanner";
import { SERVICES } from "@/lib/constants";
import {
  ArrowRightIcon,
  CargoIcon,
  CheckCircleIcon,
  GlobeIcon,
  TruckIcon,
  WarehouseIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Dịch vụ",
  description:
    "Chuyển phát nhanh nội địa, quốc tế, vận chuyển hàng hóa và kho vận & phân phối cùng Falco Express Logistics.",
};

const ICONS = {
  domestic: TruckIcon,
  international: GlobeIcon,
  cargo: CargoIcon,
  warehouse: WarehouseIcon,
} as const;

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Dịch vụ"
        title="Giải pháp vận chuyển toàn diện"
        description="Từ chuyển phát nội địa đến vận chuyển hàng hoá quốc tế và kho vận, Falco Express cung cấp giải pháp phù hợp cho từng nhu cầu."
      />

      <div className="divide-y divide-line">
        {SERVICES.map((service, i) => {
          const Icon = ICONS[service.icon];
          const reversed = i % 2 === 1;
          return (
            <section
              key={service.slug}
              id={service.slug}
              className="scroll-mt-24 py-16 sm:py-20"
            >
              <div className="container-page">
                <div
                  className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                    reversed ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <Reveal>
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-falco-gradient text-white shadow-brand">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
                      {service.title}
                    </h2>
                    <p className="mt-4 text-ink/65">{service.description}</p>
                    <ul className="mt-6 space-y-3">
                      {service.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-sm text-ink/75">
                          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/lien-he"
                      className="btn-primary mt-7 inline-flex"
                    >
                      Nhận tư vấn dịch vụ
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </Reveal>

                  <Reveal delay={0.1}>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-navy-gradient">
                      <div
                        className="absolute inset-0 opacity-[0.12]"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
                          backgroundSize: "20px 20px",
                        }}
                        aria-hidden
                      />
                      <Icon className="absolute inset-0 m-auto h-32 w-32 text-white/15 sm:h-40 sm:w-40" />
                    </div>
                  </Reveal>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <CTABanner />
    </>
  );
}
