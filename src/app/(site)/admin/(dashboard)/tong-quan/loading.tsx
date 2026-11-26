/**
 * Hiện ngay trong khung nội dung khi chuyển tab (thanh bên và topbar vẫn giữ nguyên):
 * khung xương trung tính phù hợp cả trang tổng quan, danh sách và biểu mẫu.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Đang tải">
      <div>
        <div className="h-7 w-48 rounded-xl bg-[#e7e7e3]" />
        <div className="mt-2 h-4 w-72 rounded-lg bg-[#ecece8]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-[20px] border border-[#ecece8] bg-white p-5 shadow-admin-card"
          >
            <div className="h-3.5 w-24 rounded bg-[#ecece8]" />
            <div className="mt-3 h-7 w-32 rounded-lg bg-[#e7e7e3]" />
            <div className="mt-2 h-3 w-40 rounded bg-[#f2f2ef]" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[#ecece8] bg-white p-6 shadow-admin-card">
        <div className="flex items-center justify-between gap-4 pb-4">
          <div className="h-5 w-44 rounded-lg bg-[#e7e7e3]" />
          <div className="h-8 w-28 rounded-xl bg-[#ecece8]" />
        </div>
        <div className="space-y-3 border-t border-[#f1f1ed] pt-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 py-1.5">
              <div className="h-4 w-28 rounded bg-[#e7e7e3]" />
              <div className="h-4 w-40 rounded bg-[#ecece8]" />
              <div className="h-4 flex-1 rounded bg-[#f2f2ef]" />
              <div className="h-5 w-20 rounded-full bg-[#ecece8]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
