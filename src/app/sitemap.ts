import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://falcoexpress.vn";
  const routes = ["", "/gioi-thieu", "/dich-vu", "/tra-cuu-van-don", "/lien-he"];

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
