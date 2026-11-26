/** Hiện ngay khi bấm "Xem tất cả" / đổi tab, trong lúc server lấy danh sách đơn. */
export default function TodayGroupLoading() {
  return (
    <div className="mx-auto max-w-[1100px] animate-pulse space-y-5" aria-busy="true" aria-label="Đang tải danh sách">
      <div>
        <div className="h-4 w-24 rounded bg-[#ecece8]" />
        <div className="mt-3 h-8 w-64 rounded-xl bg-[#e7e7e3]" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-9 w-40 rounded-xl bg-[#ecece8]" />
        ))}
      </div>
      <div className="space-y-1 rounded-[24px] bg-white px-6 py-5 shadow-admin-card">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-b border-[#f2f2ef] py-3 last:border-0">
            <div className="space-y-2">
              <div className="h-3.5 w-32 rounded bg-[#e7e7e3]" />
              <div className="h-3 w-56 rounded bg-[#f2f2ef]" />
            </div>
            <div className="h-5 w-24 rounded-full bg-[#ecece8]" />
          </div>
        ))}
      </div>
    </div>
  );
}
