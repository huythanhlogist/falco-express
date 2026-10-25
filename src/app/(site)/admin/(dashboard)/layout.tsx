import { redirect } from "next/navigation";
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
    <div className="min-h-screen bg-mist md:flex">
      <AdminSidebar email={session.email} role={session.role} />
      <main className="min-w-0 flex-1 px-4 py-5 text-sm sm:px-5 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
