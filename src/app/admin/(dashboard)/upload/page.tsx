import UploadOrders from "@/components/admin/UploadOrders";
import UploadPriceQuote from "@/components/admin/UploadPriceQuote";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900">Upload tài liệu</h1>
      <p className="mt-0.5 text-sm text-ink/55">
        Tải file Excel Kango lên để tự động cập nhật đơn hàng — chỉ thêm bill mới, không tạo trùng; bill đã
        có sẽ được cập nhật thông tin/mã tracking thay đổi hoặc còn thiếu.
      </p>
      <div className="mt-4">
        <UploadOrders />
      </div>

      <div className="mt-8">
        <UploadPriceQuote />
      </div>
    </div>
  );
}
