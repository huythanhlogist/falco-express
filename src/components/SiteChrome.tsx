"use client";

import { usePathname } from "next/navigation";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingHotlineButton from "@/components/FloatingHotlineButton";
import StickyContactBar from "@/components/StickyContactBar";
import ZaloOAWidget from "@/components/ZaloOAWidget";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBareLayout = pathname?.startsWith("/admin") || pathname?.startsWith("/ctv");

  // Admin/CTV cũng theo concept mới (đồng bộ với web công khai): dùng chung lớp
  // .lp-theme (góc vuông, màu đặc), giữ bóng đổ cho popup/modal (lp-theme-admin).
  if (isBareLayout) return <div className="lp-theme lp-theme-admin min-h-screen">{children}</div>;

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] bg-falco-navy px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Bỏ qua, đến nội dung chính
      </a>
      <TopBar />
      <Header />
      <main id="main" className="lp-theme flex-1">
        {children}
      </main>
      <Footer />
      {/* chừa chỗ cho thanh liên hệ dính đáy trên mobile để không che chân trang */}
      <div className="h-14 md:hidden" aria-hidden />
      <FloatingHotlineButton />
      <StickyContactBar />
      <ZaloOAWidget />
    </>
  );
}
