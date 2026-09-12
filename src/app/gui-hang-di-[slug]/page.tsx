import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import CTABanner from "@/components/CTABanner";
import { COUNTRY_ROUTES, SITE } from "@/lib/constants";
import { resolveMetadataOverride } from "@/lib/seo";
import { ArrowRightIcon, CheckCircleIcon, GlobeIcon } from "@/components/icons";
import { InternationalIllustration } from "@/components/ServiceIllustrations";

export const revalidate = 300;

function getCountry(slug: string) {
  return COUNTRY_ROUTES.find((c) => c.slug === slug);
}

export function generateStaticParams() {
  return COUNTRY_ROUTES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const country = getCountry(slug);
  if (!country) return {};

  return resolveMetadataOverride(`/gui-hang-di-${country.slug}`, {
    title: country.metaTitle,
    description: country.metaDescription,
  });
}

export default async function CountryRoutePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const country = getCountry(slug);
  if (!country) notFound();

  const otherCountries = COUNTRY_ROUTES.filter((c) => c.slug !== country.slug);

  return (
    <>
      <PageHero
        eyebrow={`Gửi hàng đi ${country.name}`}
        title={`Gửi hàng, thực phẩm và quà đi ${country.name} từ Việt Nam`}
        description={country.heroDescription}
      />

      <section className="section">
        <div className="container-page">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-falco-gradient text-white shadow-brand">
                <GlobeIcon className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
                Vì sao chọn Falco Express để gửi hàng đi {country.name}?
              </h2>
              <ul className="mt-6 space-y-3">
                {country.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-ink/75">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/lien-he" className="btn-primary">
                  Nhận báo giá gửi hàng đi {country.name}
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <a
                  href={SITE.zaloHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline"
                >
                  Chat Zalo tư vấn ngay
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <InternationalIllustration />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section bg-mist">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">Các tuyến khác</span>
            <h2 className="mt-4 max-w-xl text-2xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-3xl">
              Falco Express còn nhận gửi hàng đi
            </h2>
          </Reveal>
          <div className="mt-6 flex flex-wrap gap-3">
            {otherCountries.map((c) => (
              <Link
                key={c.slug}
                href={`/gui-hang-di-${c.slug}`}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy-800 transition hover:border-flame-400"
              >
                Gửi hàng đi {c.name}
              </Link>
            ))}
            <Link
              href="/dich-vu"
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy-800 transition hover:border-flame-400"
            >
              Xem tất cả dịch vụ
            </Link>
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
