import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import NavProgress from "@/components/admin/NavProgress";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getCurrentAdminSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <ToastProvider>
    <div className="min-h-screen bg-mist md:flex">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <AdminSidebar email={session.email} role={session.role} />
      <main className="min-w-0 flex-1 px-4 py-5 text-sm sm:px-5 sm:py-6 lg:px-8">
        <div className="admin-fade">{children}</div>
      </main>
    </div>
    </ToastProvider>
  );
}
