"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  CargoIcon,
  SearchIcon,
  GlobeIcon,
  UsersIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from "@/components/icons";

const LINKS = [
  { href: "/admin/orders", label: "Đơn hàng", icon: CargoIcon },
  { href: "/admin/seo", label: "SEO", icon: SearchIcon },
  { href: "/admin/search-console", label: "Search Console", icon: GlobeIcon },
  { href: "/admin/staff", label: "Nhân viên", icon: UsersIcon },
];

export default function AdminSidebar({
  email,
  role,
}: {
  email: string;
  role: "owner" | "staff";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white/10 text-white"
                : "text-navy-200 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4 md:hidden">
        <div className="flex items-center gap-2">
          <Image
            src="/falco-logo.png"
            alt="Falco Express logo"
            width={26}
            height={26}
            className="h-6 w-6 object-contain"
          />
          <span className="font-display text-sm font-extrabold text-navy-900">
            FALCO Admin
          </span>
        </div>
        <button
          type="button"
          aria-label={open ? "Đóng menu" : "Mở menu"}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-800 hover:bg-mist"
        >
          {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar (desktop: static, mobile: slide-in drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-navy-900 pb-4 pt-5 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-5 pb-6">
          <Image
            src="/falco-logo.png"
            alt="Falco Express logo"
            width={30}
            height={30}
            className="h-7 w-7 object-contain"
          />
          <div>
            <p className="font-display text-sm font-extrabold text-white">FALCO Admin</p>
            <p className="text-xs text-navy-300">Quản trị hệ thống</p>
          </div>
        </div>

        {nav}

        <div className="mt-4 border-t border-white/10 px-5 pt-4">
          <p className="truncate text-xs text-navy-300">{email}</p>
          <p className="mt-0.5 text-xs font-semibold text-flame-400">
            {role === "owner" ? "Chủ tài khoản" : "Nhân viên"}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-navy-200 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogoutIcon className="h-5 w-5" />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
}
