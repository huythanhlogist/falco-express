import { listCtvUsers, listCtvContentItems } from "@/lib/db";
import CtvManager from "@/components/admin/CtvManager";
import CtvContentManager from "@/components/admin/CtvContentManager";

export const dynamic = "force-dynamic";

export default async function CtvPage() {
  const [ctvs, guideItems, channelItems] = await Promise.all([
    listCtvUsers(),
    listCtvContentItems("guide"),
    listCtvContentItems("channel"),
  ]);

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Quản lý CTV</h1>
      <p className="mt-1 text-sm text-ink/55">
        Tạo và quản lý tài khoản cộng tác viên — CTV đăng nhập ở khu vực riêng /ctv
      </p>

      <div className="mt-6">
        <CtvManager initialCtvs={ctvs} />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-base font-bold text-navy-900">Hướng dẫn sử dụng (hiện cho CTV)</h2>
        <p className="mt-0.5 text-sm text-ink/55">Các bước/ghi chú CTV thấy ở tab &quot;Hướng dẫn&quot;.</p>
        <div className="mt-3">
          <CtvContentManager
            kind="guide"
            initialItems={guideItems}
            titlePlaceholder="Tiêu đề bước, vd: Bước 1 — Tạo đơn"
            contentPlaceholder="Nội dung hướng dẫn..."
          />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-base font-bold text-navy-900">Nhóm/kênh + content mẫu (hiện cho CTV)</h2>
        <p className="mt-0.5 text-sm text-ink/55">Danh sách nhóm FB/kênh hiệu quả + nội dung mẫu CTV có thể đăng.</p>
        <div className="mt-3">
          <CtvContentManager
            kind="channel"
            initialItems={channelItems}
            titlePlaceholder="Tên nhóm/kênh, vd: Hội người Việt tại Đức"
            contentPlaceholder="Link nhóm + nội dung mẫu để đăng..."
          />
        </div>
      </div>
    </div>
  );
}
