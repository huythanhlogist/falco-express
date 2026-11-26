import BayDashboard from "@/components/admin/BayDashboard";
import { isBayConfigured } from "@/lib/bay-api";

export const dynamic = "force-dynamic";

export default function BayPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-[#132440] sm:text-2xl">
          BayOnline
        </h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Theo dõi vận đơn gửi qua BayOnline, xem hành trình hãng vận chuyển, ảnh kho và tạo đơn mới ngay trên một
          màn hình.
        </p>
      </div>
      <BayDashboard configured={isBayConfigured()} />
    </div>
  );
}
