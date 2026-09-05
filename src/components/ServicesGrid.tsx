import Link from "next/link";
import Reveal from "@/components/Reveal";
import { SERVICES } from "@/lib/constants";
import {
  ArrowRightIcon,
  CargoIcon,
  GlobeIcon,
  TruckIcon,
  WarehouseIcon,
} from "@/components/icons";

const ICONS = {
  domestic: TruckIcon,
  international: GlobeIcon,
  cargo: CargoIcon,
  warehouse: WarehouseIcon,
} as const;

export default function ServicesGrid({ compact = false }: { compact?: boolean }) {
  return (
    <section className="section bg-mist">
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <span className="eyebrow">Dịch vụ của chúng tôi</span>
            <h2 className="mt-4 max-w-lg text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl">
              Đáp ứng mọi nhu cầu vận chuyển của bạn
            </h2>
          </Reveal>
          {!compact && (
            <Reveal delay={0.1}>
              <Link
                href="/dich-vu"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-800 hover:text-flame-600"
              >
                Xem tất cả dịch vụ
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </Reveal>
          )}
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service, i) => {
            const Icon = ICONS[service.icon];
            return (
              <Reveal key={service.slug} delay={i * 0.06}>
                <Link
                  href={`/dich-vu#${service.slug}`}
                  className="card group flex h-full flex-col p-6"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-falco-gradient text-white shadow-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-navy-900">
                    {service.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/60">
                    {service.short}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-flame-600">
                    Tìm hiểu thêm
                    <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
