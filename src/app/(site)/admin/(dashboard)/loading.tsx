/**
 * Hiện ngay trong khung nội dung khi chuyển tab (thanh bên vẫn giữ nguyên): khung xương thay cho màn hình
 * chờ toàn trang, để cảm giác chuyển tab liền mạch.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Đang tải">
      <div className="h-6 w-48 rounded-lg bg-line/70" />
      <div className="mt-2 h-4 w-72 rounded-lg bg-line/50" />
      <div className="mt-5 flex gap-2">
        <div className="h-9 w-64 rounded-lg bg-line/60" />
        <div className="h-9 w-20 rounded-lg bg-line/60" />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
        <div className="h-9 border-b border-line bg-mist/70" />
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-3 py-3 last:border-0">
            <div className="h-4 w-4 rounded bg-line/60" />
            <div className="h-4 w-28 rounded bg-line/70" />
            <div className="h-4 w-36 rounded bg-line/50" />
            <div className="h-4 flex-1 rounded bg-line/40" />
            <div className="h-5 w-20 rounded-full bg-line/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
