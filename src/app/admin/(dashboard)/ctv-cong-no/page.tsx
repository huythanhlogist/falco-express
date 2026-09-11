import { listCtvPayables, listOutstandingCtvCollections } from "@/lib/db";
import CtvPayoutManager from "@/components/admin/CtvPayoutManager";
import CtvRemittanceManager from "@/components/admin/CtvRemittanceManager";

export const dynamic = "force-dynamic";

export default async function CtvCongNoPage() {
  const [payables, collections] = await Promise.all([listCtvPayables(), listOutstandingCtvCollections()]);

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Công nợ CTV</h1>
      <p className="mt-1 text-sm text-ink/55">Hoa hồng Falco còn nợ CTV, và tiền CTV thu hộ khách chưa nộp lại</p>

      <div className="mt-6">
        <h2 className="font-display text-base font-bold text-navy-900">Hoa hồng phải trả</h2>
        <p className="mt-0.5 text-sm text-ink/55">Tính động từ đơn đã duyệt — trừ đi phần đã đánh dấu trả.</p>
        <div className="mt-3">
          <CtvPayoutManager initialPayables={payables} />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-base font-bold text-navy-900">Tiền CTV thu hộ chưa nộp</h2>
        <p className="mt-0.5 text-sm text-ink/55">Đơn có trạng thái thu &quot;Thu hộ (CTV)&quot; và chưa xác nhận nộp lại.</p>
        <div className="mt-3">
          <CtvRemittanceManager initialCollections={collections} />
        </div>
      </div>
    </div>
  );
}
