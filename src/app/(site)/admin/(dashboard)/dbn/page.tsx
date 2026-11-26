import DbnForm from "@/components/admin/DbnForm";
import DbnHistory from "@/components/admin/DbnHistory";
import AdminPageTabs from "@/components/admin/AdminPageTabs";

export default function DbnPage() {
  return (
    <div>
      <AdminPageTabs
        tabs={[
          { href: "/admin/bao-gia", label: "Báo giá" },
          { href: "/admin/dbn", label: "Tạo DBN" },
        ]}
      />
      <h1 className="font-display text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">Tạo DBN (báo giá cước)</h1>
      <p className="mt-1 text-sm text-ink/55">
        Chọn đơn có sẵn hoặc nhập tay, tạo xong tải ảnh gửi khách. Đơn dưới 21kg là giá cố định, không cần
        nhập đơn giá/kg.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DbnForm />
        </div>
        <div>
          <DbnHistory />
        </div>
      </div>
    </div>
  );
}
