import Link from "next/link";
import { listKangoBills } from "@/lib/db";
import KangoBillsTable from "@/components/admin/KangoBillsTable";

export const dynamic = "force-dynamic";

export default async function KangoBillsPage() {
  const bills = await listKangoBills();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Tạo bill</h1>
          <p className="mt-1 text-sm text-ink/55">
            Khởi tạo shipment gửi lên Kango — lưu nháp, sửa/xoá thoải mái, chỉ thật sự gửi khi bấm &quot;Duyệt &amp;
            Gửi Kango&quot;.
          </p>
        </div>
        <Link href="/admin/kango-bills/new" className="btn-primary !px-4 !py-2 text-sm">
          Tạo bill mới
        </Link>
      </div>

      <div className="mt-6">
        <KangoBillsTable initialBills={bills} />
      </div>
    </div>
  );
}
