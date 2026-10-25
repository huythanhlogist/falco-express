import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COUNTRY_ROUTES } from "@/lib/constants";
import { resolveMetadataOverride } from "@/lib/seo";
import CountryRoutePageContent from "@/components/CountryRoutePageContent";

/**
 * Trang tĩnh riêng cho tuyến "sec" — KHÔNG dùng route động
 * gui-hang-di-[slug]/page.tsx nữa. Lý do: trên build/host hiện tại (Next.js
 * 16 + Turbopack, deploy qua Hostinger Web Apps), route động với tên thư
 * mục ghép chữ+dynamic segment (gui-hang-di-[slug]) không sinh ra trang
 * HTML tĩnh nào ở build time (generateStaticParams không tạo file .html
 * như các trang tĩnh khác), nên mọi request đều 404 dù code/data đúng.
 * Tách thành 6 thư mục tĩnh riêng (route hoàn toàn literal) để Next chắc
 * chắn prerender ra .html giống các trang /dich-vu, /gioi-thieu đang chạy
 * tốt. Xem seo-workflow-falco-express.md để biết chi tiết điều tra.
 */
const SLUG = "sec" as const;

export const revalidate = 300;

function getCountry() {
  return COUNTRY_ROUTES.find((c) => c.slug === SLUG);
}

export async function generateMetadata(): Promise<Metadata> {
  const country = getCountry();
  if (!country) return {};

  return resolveMetadataOverride(`/gui-hang-di-${country.slug}`, {
    title: country.metaTitle,
    description: country.metaDescription,
  });
}

export default function Page() {
  const country = getCountry();
  if (!country) notFound();

  return <CountryRoutePageContent country={country} />;
}
