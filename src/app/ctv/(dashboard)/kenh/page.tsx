import { listCtvContentItems } from "@/lib/db";
import CopyOrderInfoButton from "@/components/admin/CopyOrderInfoButton";

export const dynamic = "force-dynamic";

export default async function CtvKenhPage() {
  const items = await listCtvContentItems("channel");

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Nhóm &amp; kênh</h1>
      <p className="mt-1 text-sm text-ink/55">Các nhóm FB/kênh mang lại traffic tốt kèm nội dung mẫu để đăng</p>

      <div className="mt-6 flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-display text-sm font-bold text-navy-900">{item.title}</p>
              <CopyOrderInfoButton text={item.content} />
            </div>
            <p className="mt-1.5 whitespace-pre-line text-sm text-ink/70">{item.content}</p>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink/45">
            Chưa có nhóm/kênh nào.
          </p>
        )}
      </div>
    </div>
  );
}
