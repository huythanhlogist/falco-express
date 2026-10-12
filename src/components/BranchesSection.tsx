import Reveal from "@/components/Reveal";
import { BRANCHES, SITE } from "@/lib/constants";
import { ClockIcon, MapPinIcon, PhoneIcon } from "@/components/icons";

export default function BranchesSection() {
  return (
    <section className="lp-section">
      <div className="lp-container">
        <Reveal>
          <p className="lp-eyebrow">Hệ thống chi nhánh</p>
          <h2 className="lp-h2 mt-2.5 max-w-lg">Có mặt tại 3 khu vực trọng điểm</h2>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-3 md:gap-6">
          {BRANCHES.map((branch, i) => (
            <Reveal key={branch.code} delay={i * 0.08}>
              <div className="h-full border border-falco-border border-t-[3px] border-t-falco-accent bg-white p-6">
                <span className="inline-block bg-falco-navy px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  {branch.code}
                </span>
                <h3 className="mt-4 text-lg font-bold text-falco-navy">{branch.name}</h3>
                <p className="mt-3 flex items-start gap-2.5 text-[15px] text-falco-muted">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-falco-accent" />
                  {branch.address}
                </p>
                <p className="mt-2 flex items-start gap-2.5 text-[15px] text-falco-muted">
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-falco-accent" />
                  Thứ 2 – Thứ 7: 8:00 – 18:00
                </p>
                <a
                  href={SITE.hotlineHref}
                  className="mt-4 inline-flex items-center gap-2 text-[15px] font-bold text-falco-accent hover:underline"
                >
                  <PhoneIcon className="h-4 w-4" />
                  {SITE.hotline}
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
