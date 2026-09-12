"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Reveal from "@/components/Reveal";
import { COUNTRY_ROUTES, STATS } from "@/lib/constants";
import { ArrowRightIcon, SearchIcon, TruckIcon } from "@/components/icons";

const ROUTE_POINTS = [
  { code: "HN", label: "Hà Nội" },
  { code: "NA", label: "Nghệ An" },
  { code: "HCM", label: "TP.HCM" },
];

export default function Hero() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    router.push(trimmed ? `/tra-cuu-van-don?ma=${encodeURIComponent(trimmed)}` : "/tra-cuu-van-don");
  }

  return (
    <section className="section pb-0 pt-12 sm:pt-16">
      <div className="container-page">
        <Reveal>
          <span className="eyebrow">Gửi hàng Việt Nam ➜ Châu Âu &amp; Anh</span>
        </Reveal>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:gap-10">
          <Reveal delay={0.05}>
            <h1 className="text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-navy-900 sm:text-[3.25rem] lg:text-[3.75rem]">
              Kết Nối Giá Trị
              <br />
              <span className="bg-falco-gradient bg-clip-text text-transparent">
                Giao Hàng Tận Tâm
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="text-base leading-relaxed text-ink/65 sm:text-lg">
              Falco Express chuyên gửi hàng, thực phẩm và quà từ Việt Nam sang
              Châu Âu, Vương quốc Anh cho cộng đồng người Việt xa xứ — nhanh
              chóng, an toàn và minh bạch trong từng chặng đường.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dich-vu" className="btn-primary">
                Khám phá dịch vụ
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href="/lien-he" className="btn-outline">
                Nhận báo giá
              </Link>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.16} className="mt-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-medium text-ink/50">
              Tuyến phổ biến:
            </span>
            {COUNTRY_ROUTES.map((country) => (
              <Link
                key={country.slug}
                href={`/gui-hang-di-${country.slug}`}
                className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold text-navy-800 transition hover:border-flame-400"
              >
                {country.name}
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.18} className="mt-12 lg:mt-16">
          <div className="relative overflow-hidden rounded-[28px] bg-navy-gradient sm:rounded-[32px]">
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
              aria-hidden
            />
            <TruckIcon
              className="pointer-events-none absolute -right-10 -top-14 h-64 w-64 text-white/[0.07] sm:h-80 sm:w-80"
              aria-hidden
            />

            <div className="relative grid gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:px-14">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-flame-400">
                  Tuyến vận chuyển chính
                </p>
                <div className="mt-8 flex items-center">
                  {ROUTE_POINTS.map((p, i) => (
                    <div key={p.code} className="flex items-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-flame-500 ring-4 ring-flame-500/25" />
                        <span className="text-xs font-semibold text-white/85 sm:text-sm">
                          {p.label}
                        </span>
                      </div>
                      {i < ROUTE_POINTS.length - 1 && (
                        <span
                          className="mx-2 h-px w-10 border-t border-dashed border-white/40 sm:w-20 md:w-28"
                          aria-hidden
                        />
                      )}
                    </div>
                  ))}
                  <ArrowRightIcon className="ml-2 h-4 w-4 text-white/50" aria-hidden />
                </div>
                <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
                  {STATS.map((s) => (
                    <div key={s.label}>
                      <p className="font-display text-2xl font-extrabold text-white sm:text-3xl">
                        {s.value}
                      </p>
                      <p className="mt-1 text-xs text-white/60 sm:text-sm">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl sm:p-6 lg:w-[340px]"
              >
                <p className="text-sm font-bold text-navy-800">Tra cứu vận đơn nhanh</p>
                <p className="mt-1 text-xs text-ink/55">
                  Nhập mã vận đơn để xem trạng thái đơn hàng
                </p>
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                  <label htmlFor="hero-tracking" className="sr-only">
                    Mã vận đơn
                  </label>
                  <input
                    id="hero-tracking"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VD: FL123456789VN"
                    className="w-full rounded-full border border-line px-4 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-flame-400"
                  />
                  <button type="submit" className="btn-primary shrink-0 !px-4">
                    <SearchIcon className="h-4 w-4" />
                    <span className="sm:hidden">Tra cứu</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
