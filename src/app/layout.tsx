import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import { SITE, BRANCHES } from "@/lib/constants";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
});

const SEO_DESCRIPTION =
  "Falco Express – gửi hàng, thực phẩm và quà từ Việt Nam sang Châu Âu, Vương quốc Anh (Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan...) cho người Việt xa xứ. Nhanh chóng, an toàn, minh bạch, hỗ trợ trọn gói thủ tục hải quan.";

export const metadata: Metadata = {
  metadataBase: new URL("https://falcoexpress.com"),
  title: {
    default: `${SITE.name} – Gửi hàng Việt Nam sang Châu Âu & Anh`,
    template: `%s | ${SITE.name}`,
  },
  description: SEO_DESCRIPTION,
  keywords: [
    "Falco Express",
    "gửi hàng đi Anh",
    "gửi hàng đi Đức",
    "gửi hàng từ Việt Nam sang Châu Âu",
    "gửi thực phẩm Việt sang Anh",
    "chuyển phát nhanh quốc tế",
    "vận chuyển hàng hóa",
    "kho vận",
    "tra cứu vận đơn",
  ],
  openGraph: {
    title: `${SITE.name} – Gửi hàng Việt Nam sang Châu Âu & Anh`,
    description: SEO_DESCRIPTION,
    siteName: SITE.name,
    locale: "vi_VN",
    type: "website",
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  verification: {
    google: "64U_TbBQ6JCA1mIh5iW0lA9vW6zoQw4L3LD1Q-t-hXs",
  },
};

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  legalName: SITE.fullName,
  url: "https://falcoexpress.com",
  logo: "https://falcoexpress.com/falco-logo.png",
  description: SITE.description,
  telephone: SITE.hotline,
  location: BRANCHES.map((b) => ({
    "@type": "PostalAddress",
    streetAddress: b.address,
    addressLocality: b.city,
    addressCountry: "VN",
  })),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body className="flex min-h-screen flex-col font-body">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
