import { listCtvUsers } from "@/lib/db";
import CtvManager from "@/components/admin/CtvManager";

export const dynamic = "force-dynamic";

export default async function CtvPage() {
  const ctvs = await listCtvUsers();

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Quản lý CTV</h1>
      <p className="mt-1 text-sm text-ink/55">
        Tạo và quản lý tài khoản cộng tác viên — CTV đăng nhập ở khu vực riêng /ctv
      </p>

      <div className="mt-6">
        <CtvManager initialCtvs={ctvs} />
      </div>
    </div>
  );
}
