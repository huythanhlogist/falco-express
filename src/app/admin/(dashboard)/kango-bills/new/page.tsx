import KangoBillForm from "@/components/admin/KangoBillForm";

export default function NewKangoBillPage() {
  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Tạo bill mới</h1>
      <p className="mt-1 text-sm text-ink/55">Lưu dưới dạng nháp trước — chưa gửi gì lên Kango ở bước này.</p>

      <div className="mt-6">
        <KangoBillForm />
      </div>
    </div>
  );
}
