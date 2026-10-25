import { listPriceQuoteCategories, listPolicyItems } from "@/lib/db";
import PriceQuoteTabs from "@/components/admin/price-quote/PriceQuoteTabs";
import type { PriceQuoteCategory, PriceQuoteRow } from "@/components/admin/price-quote/types";

export const dynamic = "force-dynamic";

export default async function BaoGiaPage() {
  const [categoryRows, policyItems] = await Promise.all([listPriceQuoteCategories(), listPolicyItems()]);

  const categories: PriceQuoteCategory[] = categoryRows.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    note: c.note,
    sourceFileName: c.source_file_name,
    uploadedAt: c.uploaded_at,
    lines: c.lines.map((l) => ({
      id: l.id,
      title: l.title,
      countries: l.countries,
      minWeightKg: l.min_weight_kg ? Number(l.min_weight_kg) : null,
      markupFlatVnd: l.markup_flat_vnd,
      markupPerKgVnd: l.markup_per_kg_vnd,
      rows: JSON.parse(l.rows_json) as PriceQuoteRow[],
    })),
  }));

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900">Báo giá</h1>
      <p className="mt-0.5 text-sm text-ink/55">
        Bảng giá gửi khách và chính sách vận chuyển — chỉ hiển thị trong web admin, không công khai. Tải bảng giá
        mới nhất ở tab &quot;Upload tài liệu&quot;.
      </p>
      <div className="mt-4">
        <PriceQuoteTabs categories={categories} policyItems={policyItems} />
      </div>
    </div>
  );
}
