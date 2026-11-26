import OfficeTabs from "@/components/admin/OfficeTabs";
import AdminPageTabs from "@/components/admin/AdminPageTabs";

export const metadata = { title: "Văn phòng AI — FALCO Admin" };

export default function OfficePage() {
  return (
    <div>
      <AdminPageTabs
        tabs={[
          { href: "/admin/van-phong", label: "Văn phòng AI" },
          { href: "/admin/ai-nhap-don", label: "Nhập đơn AI" },
        ]}
      />
      <OfficeTabs />
    </div>
  );
}
