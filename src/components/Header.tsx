"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LINKS, SITE } from "@/lib/constants";
import { MenuIcon, CloseIcon, PhoneIcon } from "@/components/icons";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
    <header className="sticky top-0 z-50 w-full border-b border-falco-border bg-white">
      <div className="lp-container flex items-center justify-between gap-4 py-2 lg:gap-8 lg:py-3.5">
        <Link href="/" className="flex shrink-0 items-center" aria-label={`${SITE.name} - Trang chủ`}>
          <Image
            src="/images/landing/logo-falco.png"
            alt={`${SITE.fullName} logo`}
            width={687}
            height={522}
            priority
            className="h-12 w-auto lg:h-16"
          />
        </Link>

        <nav className="hidden items-center gap-1 text-[15px] font-semibold text-falco-navy lg:flex" aria-label="Điều hướng chính">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-2.5 transition-colors hover:bg-falco-surface ${
                  active ? "bg-[#f1f3f7]" : ""
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3.5 lg:flex">
          <a href={SITE.hotlineHref} className="flex flex-col text-right leading-tight">
            <span className="text-xs text-[#6a7385]">Hotline / Zalo</span>
            <span className="text-[17px] font-extrabold text-falco-navy">{SITE.hotline}</span>
          </a>
          <a
            href={SITE.zaloHref}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-falco-accent px-[22px] py-[13px] text-[15px] font-bold text-white transition-colors hover:bg-falco-accent-dark"
          >
            Nhận báo giá
          </a>
        </div>

        <div className="flex gap-2 lg:hidden">
          <a
            href={SITE.hotlineHref}
            aria-label={`Gọi hotline ${SITE.hotline}`}
            className="flex h-11 w-11 items-center justify-center bg-falco-accent text-white"
          >
            <PhoneIcon className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center border border-[#cdd3de] text-falco-navy"
            aria-label={open ? "Đóng menu" : "Mở menu"}
            aria-expanded={open}
          >
            {open ? <CloseIcon className="h-[22px] w-[22px]" /> : <MenuIcon className="h-[22px] w-[22px]" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-falco-border bg-white px-4 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="Điều hướng di động">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-3.5 text-base font-semibold text-falco-navy ${
                  pathname === link.href ? "bg-falco-surface" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3">
            <a href={SITE.hotlineHref} className="lp-btn border border-falco-navy text-falco-navy">
              <PhoneIcon className="h-4 w-4" />
              Gọi {SITE.hotline}
            </a>
            <a href={SITE.zaloHref} target="_blank" rel="noopener noreferrer" className="lp-btn-accent">
              Nhận báo giá qua Zalo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
