"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { CloseIcon, LogoutIcon, MenuIcon, RefreshIcon } from "@/components/icons";

type IconProps = SVGProps<SVGSVGElement>;
type IconComponent = ComponentType<IconProps>;

const iconBase = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function OverviewIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function OrdersBoxIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
}

function BillCreateIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function PlaneIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

function SparklesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function FinanceWalletIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function QuoteTagIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </svg>
  );
}

function FwdTruckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function WebGlobeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function StaffUsersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...iconBase} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

type NavLinkItem = {
  href: string;
  label: string;
  icon: IconComponent;
  matchPrefixes: string[];
  ownerOnly?: boolean;
};

type NavGroup = {
  title: string;
  links: NavLinkItem[];
};

const GROUPS: NavGroup[] = [
  {
    title: "Vận hành",
    links: [
      {
        href: "/admin/tong-quan",
        label: "Tổng quan",
        icon: OverviewIcon,
        matchPrefixes: ["/admin/tong-quan"],
      },
      {
        href: "/admin/orders",
        label: "Đơn hàng",
        icon: OrdersBoxIcon,
        matchPrefixes: ["/admin/orders", "/admin/upload"],
      },
      {
        href: "/admin/kango-bills",
        label: "Tạo bill",
        icon: BillCreateIcon,
        matchPrefixes: ["/admin/kango-bills"],
      },
      {
        href: "/admin/bay",
        label: "BayOnline",
        icon: PlaneIcon,
        matchPrefixes: ["/admin/bay"],
      },
      {
        href: "/admin/van-phong",
        label: "Trợ lý AI",
        icon: SparklesIcon,
        matchPrefixes: ["/admin/van-phong", "/admin/ai-nhap-don"],
      },
    ],
  },
  {
    title: "Tài chính & Đối tác",
    links: [
      {
        href: "/admin/ke-toan",
        label: "Kế toán",
        icon: FinanceWalletIcon,
        matchPrefixes: ["/admin/ke-toan"],
      },
      {
        href: "/admin/bao-gia",
        label: "Báo giá & DBN",
        icon: QuoteTagIcon,
        matchPrefixes: ["/admin/bao-gia", "/admin/dbn"],
      },
      {
        href: "/admin/fwd",
        label: "Đối tác FWD",
        icon: FwdTruckIcon,
        matchPrefixes: ["/admin/fwd", "/admin/fwd-cong-no", "/admin/fwd-hieu-qua"],
      },
    ],
  },
  {
    title: "Cài đặt",
    links: [
      {
        href: "/admin/seo",
        label: "Website & SEO",
        icon: WebGlobeIcon,
        matchPrefixes: ["/admin/seo", "/admin/search-console"],
      },
      {
        href: "/admin/staff",
        label: "Nhân viên",
        icon: StaffUsersIcon,
        matchPrefixes: ["/admin/staff"],
        ownerOnly: true,
      },
    ],
  },
];

const ROUTE_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/admin/tong-quan", title: "Tổng quan" },
  { prefix: "/admin/orders", title: "Đơn hàng" },
  { prefix: "/admin/upload", title: "Upload tài liệu" },
  { prefix: "/admin/kango-bills", title: "Tạo bill" },
  { prefix: "/admin/bay", title: "BayOnline" },
  { prefix: "/admin/van-phong", title: "Văn phòng AI" },
  { prefix: "/admin/ai-nhap-don", title: "Nhập đơn AI" },
  { prefix: "/admin/ke-toan", title: "Kế toán" },
  { prefix: "/admin/bao-gia", title: "Báo giá" },
  { prefix: "/admin/dbn", title: "Tạo DBN" },
  { prefix: "/admin/fwd-cong-no", title: "Công nợ FWD" },
  { prefix: "/admin/fwd-hieu-qua", title: "Hiệu quả FWD" },
  { prefix: "/admin/fwd", title: "Quản lý FWD" },
  { prefix: "/admin/seo", title: "Website & SEO" },
  { prefix: "/admin/search-console", title: "Search Console" },
  { prefix: "/admin/staff", title: "Nhân viên" },
];

function matchesRoute(currentPath: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`),
  );
}

function getMobileTitle(pathname: string): string {
  const matched = ROUTE_TITLES.find(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
  );
  return matched ? matched.title : "FALCO Admin";
}

export default function AdminSidebar({
  email,
  role,
}: {
  email: string;
  role: "owner" | "staff";
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Tô sáng mục vừa bấm ngay lập tức, tự xoá khi pathname đổi hoặc quá 4 giây nếu lỗi mạng.
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPending(null);
  }, [pathname]);

  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setPending(null), 4000);
    return () => window.clearTimeout(t);
  }, [pending]);

  // Đóng ngăn kéo mobile bằng phím Escape và khoá cuộn nền khi ngăn kéo đang mở.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => !link.ownerOnly || role === "owner"),
  })).filter((group) => group.links.length > 0);

  const activePath = pending ?? pathname;
  const mobileTitle = getMobileTitle(pathname);

  const nav = (
    <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-3" aria-label="Menu quản trị">
      {visibleGroups.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 pt-0.5 text-[11px] font-medium tracking-[0.01em] text-[#9b9da3]">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.links.map((link) => {
              const active = matchesRoute(activePath, link.matchPrefixes);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setOpen(false);
                    if (pathname !== link.href) setPending(link.href);
                  }}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] leading-[1.3] transition-colors active:scale-[0.98] ${
                    active
                      ? "bg-[#132440] font-semibold text-white"
                      : "font-medium text-[#2c313a] hover:bg-[#f5f5f3] hover:text-[#14181f]"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-[#5b616e]"}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Thanh đầu trang trên mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#ecece8] bg-white px-4 md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/admin/tong-quan"
            aria-label="Trang tổng quan Falco Express"
            className="flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden"
          >
            <Image
              src="/falco-logo.png"
              alt="Falco Express"
              width={64}
              height={64}
              className="h-[60px] w-[60px] max-w-none shrink-0 object-contain"
            />
          </Link>
          <span className="truncate text-[14px] font-bold tracking-tight text-[#132440]">
            {mobileTitle}
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
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#2c313a] hover:bg-[#f5f5f3]"
          >
            <RefreshIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={open ? "Đóng menu" : "Mở menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#2c313a] hover:bg-[#f5f5f3]"
          >
            {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Lớp phủ tối khi mở ngăn kéo trên mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#132440]/40 backdrop-blur-[1px] md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Thanh bên (desktop: dính bên trái, mobile: ngăn kéo trượt vào) */}
      <aside
        aria-label="Điều hướng quản trị"
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] shrink-0 flex-col border-r border-[#ecece8] bg-white transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo cắt khung gọn như mockup */}
        <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-[#f1f1ed] px-5">
          <Link
            href="/admin/tong-quan"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5"
            aria-label="Falco Express Admin"
          >
            <span className="flex h-[44px] w-[62px] shrink-0 items-center justify-center overflow-hidden">
              <Image
                src="/falco-logo.png"
                alt="Falco Express Logistic"
                width={88}
                height={88}
                priority
                className="h-[82px] w-[82px] max-w-none shrink-0 object-contain"
              />
            </span>
          </Link>
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5b616e] hover:bg-[#f5f5f3] hover:text-[#14181f] md:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Khối nhận diện văn phòng gọn giống mockup */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[#f1f1ed] px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#132440] text-[11px] font-bold tracking-wide text-white">
            FE
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-[#14181f]">
              Falco Express
            </p>
            <p className="truncate text-[11.5px] leading-tight text-[#8b8d93]">
              Quản trị vận hành
            </p>
          </div>
        </div>

        {nav}

        {/* Chân thanh bên: email + vai trò + nút đăng xuất */}
        <div className="mt-auto shrink-0 border-t border-[#f1f1ed] px-4 py-3.5">
          <p className="truncate text-[12px] font-medium text-[#14181f]" title={email}>
            {email}
          </p>
          <p className="mt-0.5 text-[11.5px] font-medium text-[#8b8d93]">
            {role === "owner" ? "Chủ tài khoản" : "Nhân viên"}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2.5 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium text-[#4b5563] transition-colors hover:bg-[#fdecec] hover:text-[#ed1c24]"
          >
            <LogoutIcon className="h-4 w-4 shrink-0" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
}
