"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  UsersIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  RefreshIcon,
  CargoIcon,
  TagIcon,
  ShieldIcon,
  GlobeIcon,
  HandshakeIcon,
} from "@/components/icons";

// Tab thống kê sẽ thêm ở giai đoạn hoa hồng/công nợ (xem plan).
const LINKS = [
  { href: "/ctv/tao-don", label: "Tạo đơn", icon: CargoIcon },
  { href: "/ctv/bao-gia", label: "Bảng giá", icon: TagIcon },
  { href: "/ctv/chinh-sach", label: "Chính sách", icon: ShieldIcon },
  { href: "/ctv/huong-dan", label: "Hướng dẫn", icon: GlobeIcon },
  { href: "/ctv/kenh", label: "Nhóm & kênh", icon: HandshakeIcon },
  { href: "/ctv/tai-khoan", label: "Tài khoản", icon: UsersIcon },
];

export default function CtvSidebar({ ctvCode, fullName }: { ctvCode: string; fullName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/ctv/logout", { method: "POST" });
    router.push("/ctv/login");
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
              active ? "bg-white/10 text-white" : "text-navy-200 hover:bg-white/5 hover:text-white"
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
      <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4 md:hidden">
        <div className="flex items-center gap-2">
          <Image
            src="/falco-logo.png"
            alt="Falco Express logo"
            width={26}
            height={26}
            className="h-6 w-6 rounded-full object-cover ring-1 ring-line"
          />
          <span className="font-display text-sm font-extrabold text-navy-900">FALCO CTV</span>
        </div>
        <div className="flex items-center gap-1">
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

      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

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
            <p className="font-display text-sm font-extrabold text-white">FALCO CTV</p>
            <p className="text-xs text-navy-300">Cộng tác viên</p>
          </div>
        </div>

        {nav}

        <div className="mt-3 border-t border-white/10 px-4 pt-3">
          <p className="truncate text-xs text-navy-300">{fullName}</p>
          <p className="mt-0.5 text-xs font-semibold text-flame-400">{ctvCode}</p>
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
