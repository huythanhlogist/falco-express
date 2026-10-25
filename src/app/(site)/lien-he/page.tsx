import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import ContactForm from "@/components/ContactForm";
import { BRANCHES, SITE } from "@/lib/constants";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import { resolveMetadataOverride } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return resolveMetadataOverride("/lien-he", {
    title: "Liên hệ",
    description:
      "Liên hệ Falco Express Logistics qua hotline, email hoặc ghé thăm chi nhánh tại Hà Nội, TP. Hồ Chí Minh và Nghệ An.",
  });
}

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Liên hệ"
        title="Chúng tôi luôn sẵn sàng hỗ trợ bạn"
        description="Gọi hotline, nhắn Zalo hoặc gửi yêu cầu qua form bên dưới – đội ngũ Falco Express sẽ phản hồi nhanh chóng."
      />

      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <Reveal>
            <div className="card p-6 sm:p-8">
              <h2 className="text-lg font-bold text-navy-900">Thông tin liên hệ</h2>
              <ul className="mt-5 space-y-4">
                <li className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-flame-50 text-flame-600">
                    <PhoneIcon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">Hotline / Zalo</p>
                    <a href={SITE.hotlineHref} className="text-sm text-ink/65 hover:text-flame-600">
                      {SITE.hotline}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-flame-50 text-flame-600">
                    <MailIcon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">Email</p>
                    <a href={`mailto:${SITE.email}`} className="text-sm text-ink/65 hover:text-flame-600">
                      {SITE.email}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-flame-50 text-flame-600">
                    <ClockIcon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">Giờ làm việc</p>
                    <p className="text-sm text-ink/65">Thứ 2 – Thứ 7: 8:00 – 18:00</p>
                  </div>
                </li>
              </ul>

              <div className="mt-6 space-y-4 border-t border-line pt-6">
                {BRANCHES.map((b) => (
                  <div key={b.code} className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
                      <MapPinIcon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-navy-900">{b.name}</p>
                      <p className="text-sm text-ink/65">{b.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>
        </div>
      </section>

      <section className="section bg-mist pt-0">
        <div className="container-page">
          <Reveal>
            <h2 className="text-2xl font-extrabold tracking-tight text-navy-900">
              Bản đồ chi nhánh
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {BRANCHES.map((b, i) => (
              <Reveal key={b.code} delay={i * 0.08}>
                <div className="overflow-hidden rounded-2xl border border-line shadow-card">
                  <iframe
                    title={`Bản đồ ${b.name}`}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(b.mapQuery)}&output=embed`}
                    className="h-64 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="bg-white p-4">
                    <p className="text-sm font-bold text-navy-900">{b.name}</p>
                    <p className="mt-1 text-xs text-ink/60">{b.address}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
