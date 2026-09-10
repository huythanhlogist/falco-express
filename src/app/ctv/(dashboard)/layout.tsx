import { redirect } from "next/navigation";
import CtvSidebar from "@/components/ctv/CtvSidebar";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { findCtvById } from "@/lib/db";

export default async function CtvDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/ctv/login");

  const ctv = await findCtvById(session.ctvId);
  if (!ctv || ctv.status !== "active") redirect("/ctv/login");

  return (
    <div className="min-h-screen bg-mist md:flex">
      <CtvSidebar ctvCode={ctv.ctv_code} fullName={ctv.full_name} />
      <main className="min-w-0 flex-1 px-4 py-5 text-sm sm:px-5 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
