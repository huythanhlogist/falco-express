import { listAdminUsers } from "@/lib/db";
import { getCurrentAdminSession } from "@/lib/auth";
import StaffManager from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await getCurrentAdminSession();
  const staff = await listAdminUsers();

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Nhân viên</h1>
      <p className="mt-1 text-sm text-ink/55">Quản lý tài khoản đăng nhập trang quản trị</p>

      <div className="mt-6">
        <StaffManager
          initialStaff={staff}
          currentEmail={session?.email ?? ""}
          canManage={session?.role === "owner"}
        />
      </div>
    </div>
  );
}
