import BayDashboard from "@/components/admin/BayDashboard";
import { isBayConfigured } from "@/lib/bay-api";

export const dynamic = "force-dynamic";

export default function BayPage() {
  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">BayOnline</h1>
      <p className="mt-1 text-sm text-ink/55">
        Vận đơn gửi qua BayOnline (Partner API): trạng thái, hành trình hãng vận chuyển và ảnh kho chụp lúc nhận,
        kiểm, cân.
      </p>
      <div className="mt-6">
        <BayDashboard configured={isBayConfigured()} />
      </div>
    </div>
  );
}
