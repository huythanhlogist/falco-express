import type { MetadataRoute } from "next";
import { COUNTRY_ROUTES } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://falcoexpress.com";
  const routes = ["", "/gioi-thieu", "/dich-vu", "/tra-cuu-van-don", "/lien-he"];
  const countryRoutes = COUNTRY_ROUTES.map((c) => `/gui-hang-di-${c.slug}`);

  return [...routes, ...countryRoutes].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : countryRoutes.includes(route) ? 0.8 : 0.7,
  }));
}
