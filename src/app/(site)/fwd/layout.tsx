import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "FALCO FWD" },
  icons: { icon: "/falco-logo.png", apple: "/falco-logo.png" },
  // Khu vực nội bộ cho FWD — không cần Google lập chỉ mục.
  robots: { index: false, follow: false },
};

export default function CtvLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-mist">{children}</div>;
}
