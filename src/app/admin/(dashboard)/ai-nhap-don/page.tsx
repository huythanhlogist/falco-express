import AiIntakeForm from "@/components/admin/AiIntakeForm";

export default function AiIntakePage() {
  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Nhập đơn cho AI tạo bill</h1>
      <p className="mt-1 text-sm text-ink/55">
        Dán ghi chú + tải ảnh cho từng đơn — Claude sẽ đọc và tạo bill nháp khi bạn yêu cầu trong chat.
      </p>

      <div className="mt-6">
        <AiIntakeForm />
      </div>
    </div>
  );
}
