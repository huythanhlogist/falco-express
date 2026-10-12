import Image from "next/image";
import { PROCESS_STEPS } from "@/lib/landing-content";
import { STATS } from "@/lib/constants";
import SectionHeading from "./SectionHeading";

export default function ProcessSection() {
  const onTime = STATS.find((s) => s.value === "99%");
  return (
    <section className="lp-container flex flex-wrap items-center gap-8 py-14 sm:gap-14 sm:py-20 lg:py-[100px]">
      <div className="relative hidden min-w-0 flex-[1_1_420px] sm:block">
        <div className="relative h-[480px]">
          <Image
            src="/images/landing/why-falco.webp"
            alt="Tàu container và cẩu bốc hàng tại cảng"
            fill
            sizes="(min-width: 1024px) 45vw, 90vw"
            className="object-cover"
          />
        </div>
        {onTime && (
          <div className="absolute bottom-6 left-6 flex items-center gap-3.5 bg-white px-5 py-4 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
            <span className="flex h-11 w-11 items-center justify-center bg-falco-accent">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span>
              <span className="block font-extrabold text-falco-navy">{onTime.value} đúng hẹn</span>
              <span className="text-[13px] text-[#6a7385]">trên các tuyến Châu Âu</span>
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-[1_1_480px]">
        <p className="lp-eyebrow">Quy trình</p>
        <h2 className="lp-h2 mb-1 mt-2.5">Gửi hàng chỉ trong 4 bước</h2>
        <div className="mb-6 mt-2.5 h-[3px] w-12 bg-falco-accent sm:hidden" aria-hidden />
        <ol className="mt-6 flex flex-col gap-3.5 sm:mt-7">
          {PROCESS_STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-4 bg-falco-surface p-4 sm:gap-[18px] sm:p-[18px]">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center font-extrabold text-white ${
                  i === PROCESS_STEPS.length - 1 ? "bg-falco-accent" : "bg-falco-navy"
                }`}
              >
                {i + 1}
              </span>
              <span>
                <span className="block text-[17px] font-bold text-falco-navy">{step.title}</span>
                <span className="text-[15px] text-falco-muted">{step.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
