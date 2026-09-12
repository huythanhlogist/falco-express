import Link from "next/link";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import CTABanner from "@/components/CTABanner";
import { COUNTRY_ROUTES, EU_CUSTOMS_FAQS, SITE, UK_CUSTOMS_FAQS, type CountryRoute } from "@/lib/constants";
import { ArrowRightIcon, CheckCircleIcon, GlobeIcon } from "@/components/icons";
import { InternationalIllustration } from "@/components/ServiceIllustrations";

/**
 * Nội dung dùng chung cho các trang tuyến quốc gia (gui-hang-di-duc,
 * gui-hang-di-anh, ...). Mỗi tuyến có 1 page.tsx riêng (thư mục tĩnh,
 * KHÔNG dùng dynamic segment [slug]) để đảm bảo Next.js prerender ra file
 * HTML tĩnh thật sự — xem ghi chú trong seo-workflow-falco-express.md về
 * lý do bỏ route động gui-hang-di-[slug] (không sinh ra trang tĩnh trên
 * môi trường build/host hiện tại, luôn trả 404 dù code đúng).
 */
export default function CountryRoutePageContent({ country }: { country: CountryRoute }) {
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

      <section className="section">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">Hải quan &amp; thuế</span>
            <h2 className="mt-4 max-w-xl text-2xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-3xl">
              Gửi hàng đi {country.name} có phải đóng thuế không?
            </h2>
          </Reveal>
          <div className="mt-8 space-y-3">
            {(country.customsRegion === "uk" ? UK_CUSTOMS_FAQS : EU_CUSTOMS_FAQS).map((faq) => (
              <div key={faq.question} className="card p-5 sm:p-6">
                <p className="text-sm font-semibold text-navy-900 sm:text-base">
                  {faq.question}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{faq.answer}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-ink/45">
            Thông tin chung mang tính tham khảo (cập nhật 09/2026), không phải tư vấn
            thuế/pháp lý — quy định hải quan có thể thay đổi và còn tuỳ từng lô hàng cụ
            thể. Liên hệ Falco Express để được tư vấn chính xác cho lô hàng của bạn.
          </p>
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
