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
          <h1 className="font-display text-xl font-bold tracking-tight text-[#132440] sm:text-2xl">Tạo bill</h1>
          <p className="mt-1 text-sm text-[#8b8d93]">
            Khởi tạo shipment gửi lên Kango — lưu nháp, sửa/xoá thoải mái, chỉ thật sự gửi khi bấm &quot;Duyệt &amp;
            Gửi Kango&quot;.
          </p>
        </div>
        <Link href="/admin/kango-bills/new" className="btn-primary !px-4 !py-2 text-sm">
          Tạo bill mới
        </Link>
      </div>

      <div className="mt-5">
        <KangoBillsTable initialBills={bills} />
      </div>
    </div>
  );
}
