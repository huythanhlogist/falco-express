"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin/orders", label: "Đơn hàng" },
  { href: "/admin/seo", label: "SEO" },
  { href: "/admin/search-console", label: "Search Console" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="border-b border-line bg-white">
      <div className="container-page flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin/orders" className="flex items-center gap-2">
            <Image
              src="/falco-logo.png"
              alt="Falco Express logo"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <span className="font-display text-sm font-extrabold text-navy-900">
              FALCO Admin
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-navy-50 text-navy-800"
                      : "text-ink/60 hover:bg-navy-50 hover:text-navy-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink/70 hover:bg-mist"
        >
          Đăng xuất
        </button>
      </div>
      <nav className="container-page flex items-center gap-1 overflow-x-auto pb-3 sm:hidden">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                active ? "bg-navy-50 text-navy-800" : "text-ink/60"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
