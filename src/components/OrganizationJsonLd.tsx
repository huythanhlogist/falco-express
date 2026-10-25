import { SITE, BRANCHES } from "@/lib/constants";

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


// Dữ liệu có cấu trúc của Falco — chỉ render ở web Falco, KHÔNG render ở trang thương hiệu riêng của CTV (/t/…).
export default function OrganizationJsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }} />;
}
