import { redirect } from "next/navigation";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { getTrackingSiteByCtv } from "@/lib/ctv-portal";
import { findCtvById } from "@/lib/db";
import { trackingBaseDomain } from "@/lib/tracking-domain";
import TrackingSiteEditor from "@/components/ctv/TrackingSiteEditor";

export const dynamic = "force-dynamic";

export default async function CtvTrackingSitePage() {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/ctv/login");
  const [site, ctv] = await Promise.all([getTrackingSiteByCtv(session.ctvId), findCtvById(session.ctvId)]);

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Tracking Site</h1>
      <p className="mt-1 text-sm text-ink/55">Trang tra cứu đơn hàng mang thương hiệu của bạn — khách chỉ thấy logo, màu và thông tin liên hệ của bạn.</p>
      <div className="mt-5">
        <TrackingSiteEditor
          initial={site}
          baseDomain={trackingBaseDomain()}
          defaults={{ display_name: ctv?.contact_name || ctv?.full_name || "", phone: ctv?.contact_phone || ctv?.phone || "" }}
        />
      </div>
    </div>
  );
}
