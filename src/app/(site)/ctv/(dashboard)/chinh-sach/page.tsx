import { redirect } from "next/navigation";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { findCtvById, listPolicyItems } from "@/lib/db";
import CtvPolicyCard from "@/components/ctv/CtvPolicyCard";

export const dynamic = "force-dynamic";

export default async function CtvChinhSachPage() {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/ctv/login");

  const [ctv, items] = await Promise.all([findCtvById(session.ctvId), listPolicyItems()]);
  if (!ctv) redirect("/ctv/login");

  const commissionPct = Number(ctv.commission_pct);
  const overridePct = Number(ctv.referral_override_pct);

  const contact = {
    name: ctv.contact_name || ctv.full_name,
    phone: ctv.contact_phone || ctv.phone,
    zaloHref: ctv.contact_zalo_href || `tel:${ctv.phone}`,
    website: "falcoexpress.com",
    websiteHref: "https://falcoexpress.com/tra-cuu-van-don",
  };

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Chính sách</h1>
      <p className="mt-1 text-sm text-ink/55">Chính sách vận chuyển gửi khách + chính sách hoa hồng CTV</p>

      <div className="mt-4 rounded-xl border border-line bg-white p-5">
        <p className="font-display text-sm font-bold text-navy-900">Chính sách hoa hồng CTV</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink/75">
          <li>
            • Bạn nhận <strong>{commissionPct}%</strong> trên doanh thu mỗi đơn hàng do chính bạn tạo, sau khi đơn
            được Falco duyệt.
          </li>
          <li>
            • Khi bạn giới thiệu được 1 CTV khác, bạn nhận thêm <strong>{overridePct}%</strong> liên tục trên doanh
            thu (các đơn đã duyệt) của CTV đó — không giới hạn thời gian, chỉ tính 1 cấp trực tiếp bạn giới thiệu.
          </li>
        </ul>
      </div>

      <div className="mt-6">
        <p className="font-display text-sm font-bold text-navy-900">Chính sách vận chuyển (gửi khách)</p>
        <div className="mt-3">
          <CtvPolicyCard items={items} contact={contact} />
        </div>
      </div>
    </div>
  );
}
