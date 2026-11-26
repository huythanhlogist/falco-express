import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import NavProgress from "@/components/admin/NavProgress";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";
import { getCurrentAdminSession } from "@/lib/auth";
import { vnDateString } from "@/lib/vn-date";

function formatVnToday(): string {
  const [y, m, d] = vnDateString().split("-");
  return `${d}/${m}/${y}`;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentAdminSession();
  if (!session) redirect("/admin/login");

  const todayLabel = formatVnToday();

  return (
    <ToastProvider>
      <div className="admin-shell min-h-screen bg-[#f5f5f3] text-[#14181f] md:flex">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <AdminSidebar email={session.email} role={session.role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="px-4 pt-3 sm:px-6 sm:pt-4 lg:px-7">
            <AdminTopbar email={session.email} role={session.role} todayLabel={todayLabel} />
          </div>
          <main className="min-w-0 flex-1 px-4 pb-8 pt-4 text-sm sm:px-6 lg:px-7">
            <div className="admin-fade">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
