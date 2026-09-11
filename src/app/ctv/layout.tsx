import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FALCO CTV",
  // Khu vực nội bộ cho cộng tác viên — không cần Google lập chỉ mục.
  robots: { index: false, follow: false },
};

export default function CtvLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-mist">{children}</div>;
}
