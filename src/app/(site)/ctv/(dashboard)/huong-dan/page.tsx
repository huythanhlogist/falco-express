import { listCtvContentItems } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CtvHuongDanPage() {
  const items = await listCtvContentItems("guide");

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Hướng dẫn sử dụng</h1>
      <p className="mt-1 text-sm text-ink/55">Các bước cơ bản để tạo đơn và làm việc với Falco</p>

      <div className="mt-6 flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={item.id} className="rounded-xl border border-line bg-white p-4">
            <p className="font-display text-sm font-bold text-navy-900">
              {i + 1}. {item.title}
            </p>
            <p className="mt-1.5 whitespace-pre-line text-sm text-ink/70">{item.content}</p>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink/45">
            Chưa có nội dung hướng dẫn.
          </p>
        )}
      </div>
    </div>
  );
}
