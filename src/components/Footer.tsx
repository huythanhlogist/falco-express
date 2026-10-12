import Link from "next/link";
import Image from "next/image";
import { BRANCHES, COUNTRY_ROUTES, NAV_LINKS, SITE } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="bg-falco-navy text-sm text-[#c3cbda]">
      <div className="lp-container grid gap-9 pb-9 pt-14 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.9fr_1.4fr]">
        <div>
          <div className="inline-block bg-white px-3 py-2">
            <Image
              src="/images/landing/logo-falco.png"
              alt={`${SITE.fullName} logo`}
              width={687}
              height={522}
              className="h-12 w-auto"
            />
          </div>
          <p className="mt-3.5 max-w-xs">
            Gửi hàng, thực phẩm và quà từ Việt Nam sang Châu Âu &amp; Anh cho người Việt xa xứ.
          </p>
          <p className="mt-3 font-semibold text-falco-accent-soft">{SITE.tagline}</p>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:contents">
        <div>
          <h3 className="mb-3 font-bold text-white">Liên kết</h3>
          <ul className="flex flex-col gap-2">
            {NAV_LINKS.filter((l) => l.href !== "/").map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 font-bold text-white">Tuyến gửi</h3>
          <ul className="flex flex-col gap-2">
            {COUNTRY_ROUTES.map((country) => (
              <li key={country.slug}>
                <Link href={`/gui-hang-di-${country.slug}`} className="transition-colors hover:text-white">
                  Gửi hàng đi {country.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        </div>

        <div>
          <h3 className="mb-3 font-bold text-white">Liên hệ</h3>
          <ul className="flex flex-col gap-2">
            <li>
              <a href={SITE.hotlineHref} className="transition-colors hover:text-white">
                Hotline / Zalo: {SITE.hotline}
              </a>
            </li>
            <li>
              <a href={`mailto:${SITE.email}`} className="transition-colors hover:text-white">
                {SITE.email}
              </a>
            </li>
            <li>T2 – T7: 8:00 – 18:00</li>
            {BRANCHES.map((b) => (
              <li key={b.code}>
                <span className="font-semibold text-white">{b.city}: </span>
                {b.address}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-falco-navy-line px-4 py-[18px] text-center text-[13px] text-[#98a3b8]">
        © {new Date().getFullYear()} {SITE.fullName}. Bảo lưu mọi quyền.
      </div>
    </footer>
  );
}
