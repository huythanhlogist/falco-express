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

  // Admin/CTV giữ nguyên giao diện cũ (font Be Vietnam Pro, nền/chữ cũ) — lớp
  // admin-scope ánh xạ lại biến font và màu nền cho vùng này.
  if (isBareLayout) return <div className="admin-scope min-h-screen bg-paper font-body text-ink">{children}</div>;

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
