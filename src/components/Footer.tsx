import Link from "next/link";
import Image from "next/image";
import { BRANCHES, NAV_LINKS, SITE } from "@/lib/constants";
import { MailIcon, MapPinIcon, PhoneIcon } from "@/components/icons";

export default function Footer() {
  return (
    <footer className="bg-navy-gradient text-white">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr] lg:py-20">
        <div>
          <div className="flex items-center gap-2.5">
            <Image
              src="/falco-logo.png"
              alt={`${SITE.fullName} logo`}
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg bg-white object-contain p-1"
            />
            <span className="flex flex-col leading-none">
              <span className="font-display text-base font-extrabold tracking-tight text-white">
                FALCO
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-flame-400">
                Express Logistic
              </span>
            </span>
          </div>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/65">
            {SITE.description}
          </p>
          <p className="mt-4 text-sm font-semibold text-flame-400">{SITE.tagline}</p>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">
            Liên kết
          </h3>
          <ul className="mt-5 space-y-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-white/75 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">
            Dịch vụ
          </h3>
          <ul className="mt-5 space-y-3">
            <li>
              <Link href="/dich-vu#chuyen-phat-noi-dia" className="text-sm text-white/75 hover:text-white">
                Chuyển phát nội địa
              </Link>
            </li>
            <li>
              <Link href="/dich-vu#chuyen-phat-quoc-te" className="text-sm text-white/75 hover:text-white">
                Chuyển phát quốc tế
              </Link>
            </li>
            <li>
              <Link href="/dich-vu#van-chuyen-hang-hoa" className="text-sm text-white/75 hover:text-white">
                Vận chuyển hàng hóa
              </Link>
            </li>
            <li>
              <Link href="/dich-vu#kho-van-phan-phoi" className="text-sm text-white/75 hover:text-white">
                Kho vận &amp; phân phối
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">
            Liên hệ
          </h3>
          <ul className="mt-5 space-y-4">
            <li className="flex items-start gap-3">
              <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-flame-400" />
              <a href={SITE.hotlineHref} className="text-sm text-white/85 hover:text-white">
                Hotline / Zalo: {SITE.hotline}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-flame-400" />
              <a href={`mailto:${SITE.email}`} className="text-sm text-white/85 hover:text-white">
                {SITE.email}
              </a>
            </li>
            {BRANCHES.map((b) => (
              <li key={b.code} className="flex items-start gap-3">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-flame-400" />
                <span className="text-sm text-white/75">
                  <span className="font-semibold text-white/90">{b.city}: </span>
                  {b.address}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 sm:flex-row">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} {SITE.fullName}. Bảo lưu mọi quyền.
          </p>
          <p className="text-xs text-white/50">
            Kết nối giá trị – Giao hàng tận tâm
          </p>
        </div>
      </div>
    </footer>
  );
}
