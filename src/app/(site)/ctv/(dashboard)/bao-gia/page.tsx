import { redirect } from "next/navigation";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { findCtvById, listPriceQuoteCategories } from "@/lib/db";
import PriceQuoteCard from "@/components/admin/price-quote/PriceQuoteCard";
import type { PriceQuoteCategory, PriceQuoteRow } from "@/components/admin/price-quote/types";

export const dynamic = "force-dynamic";

export default async function CtvBaoGiaPage() {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/ctv/login");

  const [ctv, categoryRows] = await Promise.all([findCtvById(session.ctvId), listPriceQuoteCategories()]);
  if (!ctv) redirect("/ctv/login");

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

  const contact = {
    name: ctv.contact_name || ctv.full_name,
    phone: ctv.contact_phone || ctv.phone,
    zaloHref: ctv.contact_zalo_href || `tel:${ctv.phone}`,
    website: "falcoexpress.com",
    websiteHref: "https://falcoexpress.com/tra-cuu-van-don",
  };

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Bảng giá</h1>
      <p className="mt-1 text-sm text-ink/55">
        Giống bảng giá của Falco — chân trang tự dùng thông tin liên hệ của bạn. Sửa ở tab &quot;Tài khoản&quot; nếu
        cần đổi.
      </p>

      {categories.length === 0 ? (
        <div className="card mt-6 p-8 text-center text-sm text-ink/50">Chưa có bảng giá nào.</div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {categories.map((category) => (
            <div key={category.id}>
              <h2 className="font-display text-base font-bold text-navy-900">{category.title}</h2>
              {category.note && <p className="mt-0.5 text-sm text-ink/55">{category.note}</p>}
              <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {category.lines.map((line) => (
                  <PriceQuoteCard key={line.id} line={line} contact={contact} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
