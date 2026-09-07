import AdminNav from "@/components/admin/AdminNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminNav />
      <main className="container-page py-8">{children}</main>
    </div>
  );
}
