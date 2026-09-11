"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingHotlineButton from "@/components/FloatingHotlineButton";
import ZaloOAWidget from "@/components/ZaloOAWidget";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBareLayout = pathname?.startsWith("/admin") || pathname?.startsWith("/ctv");

  if (isBareLayout) return <>{children}</>;

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingHotlineButton />
      <ZaloOAWidget />
    </>
  );
}
