import Image from "next/image";
import Reveal from "@/components/Reveal";

export default function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-falco-navy-dark text-white">
      <Image
        src="/images/landing/hero-port.webp"
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,18,32,0.92)_0%,rgba(11,18,32,0.72)_55%,rgba(11,18,32,0.4)_100%)]"
        aria-hidden
      />
      <div className="lp-container py-14 sm:py-[72px] lg:py-24">
        <Reveal>
          <p className="lp-eyebrow lp-eyebrow-soft lp-eyebrow-line">{eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] sm:text-5xl lg:text-[52px]">
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#dce2ec] sm:text-lg">
              {description}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
