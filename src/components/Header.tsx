"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LINKS, SITE } from "@/lib/constants";
import { MenuIcon, CloseIcon, PhoneIcon, SearchIcon } from "@/components/icons";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-colors duration-300 ${
        scrolled
          ? "border-line bg-white/90 backdrop-blur-md"
          : "border-transparent bg-white"
      }`}
    >
      <div className="container-page flex h-[76px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITE.name} - Trang chủ`}>
          <Image
            src="/falco-icon.png"
            alt={`${SITE.fullName} logo`}
            width={44}
            height={44}
            priority
            className="h-11 w-11 rounded-full object-cover ring-1 ring-line"
          />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-extrabold tracking-tight text-navy-800">
              FALCO
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-flame-600">
              Express Logistic
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-[15px] font-medium transition-colors duration-200 ${
                  active
                    ? "bg-navy-50 text-navy-800"
                    : "text-ink/70 hover:bg-navy-50 hover:text-navy-800"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={SITE.hotlineHref}
            className="flex items-center gap-2 text-sm font-semibold text-navy-800"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-50 text-navy-700">
              <PhoneIcon className="h-4 w-4" />
            </span>
            {SITE.hotline}
          </a>
          <Link href="/tra-cuu-van-don" className="btn-primary">
            <SearchIcon className="h-4 w-4" />
            Tra cứu vận đơn
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-navy-800 hover:bg-navy-50 lg:hidden"
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
        >
          {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-white px-5 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="Điều hướng di động">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3 py-3 text-base font-medium ${
                  pathname === link.href
                    ? "bg-navy-50 text-navy-800"
                    : "text-ink/80 hover:bg-navy-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3">
            <a href={SITE.hotlineHref} className="btn-outline w-full">
              <PhoneIcon className="h-4 w-4" />
              Gọi {SITE.hotline}
            </a>
            <Link href="/tra-cuu-van-don" className="btn-primary w-full">
              <SearchIcon className="h-4 w-4" />
              Tra cứu vận đơn
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
