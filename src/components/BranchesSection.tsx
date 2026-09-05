import Reveal from "@/components/Reveal";
import { BRANCHES, SITE } from "@/lib/constants";
import { ClockIcon, MapPinIcon, PhoneIcon } from "@/components/icons";

export default function BranchesSection() {
  return (
    <section className="section">
      <div className="container-page">
        <Reveal>
          <span className="eyebrow">Hệ thống chi nhánh</span>
          <h2 className="mt-4 max-w-lg text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl">
            Có mặt tại 3 khu vực trọng điểm
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {BRANCHES.map((branch, i) => (
            <Reveal key={branch.code} delay={i * 0.08}>
              <div className="card h-full p-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy-700">
                  {branch.code}
                </span>
                <h3 className="mt-4 text-lg font-bold text-navy-900">
                  {branch.name}
                </h3>
                <p className="mt-3 flex items-start gap-2.5 text-sm text-ink/60">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
                  {branch.address}
                </p>
                <p className="mt-2 flex items-start gap-2.5 text-sm text-ink/60">
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
                  Thứ 2 – Thứ 7: 8:00 – 18:00
                </p>
                <a
                  href={SITE.hotlineHref}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-flame-600 hover:text-flame-700"
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
