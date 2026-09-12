import { listSeoSettings } from "@/lib/db";
import SeoEditor from "@/components/admin/SeoEditor";
import { COUNTRY_ROUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const PAGES = [
  { path: "/", label: "Trang chủ" },
  { path: "/gioi-thieu", label: "Giới thiệu" },
  { path: "/dich-vu", label: "Dịch vụ" },
  { path: "/tra-cuu-van-don", label: "Tra cứu vận đơn" },
  { path: "/lien-he", label: "Liên hệ" },
  ...COUNTRY_ROUTES.map((c) => ({
    path: `/gui-hang-di-${c.slug}`,
    label: `Gửi hàng đi ${c.name}`,
  })),
];

export default async function AdminSeoPage() {
  const settings = await listSeoSettings();
  const initialValues = Object.fromEntries(
    PAGES.map((p) => {
      const existing = settings.find((s) => s.page_path === p.path);
      return [
        p.path,
        {
          metaTitle: existing?.meta_title || "",
          metaDescription: existing?.meta_description || "",
        },
      ];
    })
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy-900">SEO</h1>
      <p className="mt-1 text-sm text-ink/55">
        Chỉnh tiêu đề &amp; mô tả từng trang. Để trống để dùng nội dung mặc định của trang.
      </p>
      <div className="mt-6">
        <SeoEditor pages={PAGES} initialValues={initialValues} />
      </div>
    </div>
  );
}
