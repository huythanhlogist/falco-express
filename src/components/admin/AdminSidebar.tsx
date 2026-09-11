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
  WalletIcon,
  UploadIcon,
  TagIcon,
  RefreshIcon,
  HandshakeIcon,
} from "@/components/icons";

const LINKS = [
  { href: "/admin/orders", label: "Đơn hàng", icon: CargoIcon },
  { href: "/admin/ke-toan", label: "Kế toán", icon: WalletIcon },
  { href: "/admin/bao-gia", label: "Báo giá", icon: TagIcon },
  { href: "/admin/ctv", label: "Quản lý CTV", icon: HandshakeIcon },
  { href: "/admin/ctv-cong-no", label: "Công nợ CTV", icon: WalletIcon },
  { href: "/admin/upload", label: "Upload tài liệu", icon: UploadIcon },
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
    <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-white/10 text-white"
                : "text-navy-200 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
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
            className="h-6 w-6 rounded-full object-cover ring-1 ring-line"
          />
          <span className="font-display text-sm font-extrabold text-navy-900">
            FALCO Admin
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* App đã khoá pinch-to-zoom nên vuốt-để-làm-mới của trình duyệt
              không hoạt động ổn định trên iOS — thêm nút bấm làm mới thay
              thế, luôn hoạt động chắc chắn thay vì phụ thuộc cử chỉ hệ điều
              hành. Tải lại toàn trang (không chỉ router.refresh) để chắc
              chắn lấy đúng bản mới nhất. */}
          <button
            type="button"
            aria-label="Làm mới trang"
            title="Làm mới trang"
            onClick={() => window.location.reload()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-800 hover:bg-mist"
          >
            <RefreshIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={open ? "Đóng menu" : "Mở menu"}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-800 hover:bg-mist"
          >
            {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
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
        className={`fixed inset-y-0 left-0 z-50 flex w-56 shrink-0 flex-col bg-navy-900 pb-3 pt-4 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-4 pb-5">
          <Image
            src="/falco-logo.png"
            alt="Falco Express logo"
            width={30}
            height={30}
            className="h-7 w-7 rounded-full object-cover ring-1 ring-white/15"
          />
          <div>
            <p className="font-display text-sm font-extrabold text-white">FALCO Admin</p>
            <p className="text-xs text-navy-300">Quản trị hệ thống</p>
          </div>
        </div>

        {nav}

        <div className="mt-3 border-t border-white/10 px-4 pt-3">
          <p className="truncate text-xs text-navy-300">{email}</p>
          <p className="mt-0.5 text-xs font-semibold text-flame-400">
            {role === "owner" ? "Chủ tài khoản" : "Nhân viên"}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-navy-200 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogoutIcon className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
}
