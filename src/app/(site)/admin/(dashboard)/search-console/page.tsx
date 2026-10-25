export default function AdminSearchConsolePage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy-900">Search Console</h1>
      <p className="mt-1 text-sm text-ink/55">
        Báo cáo lượt tìm kiếm &amp; nhấp chuột từ Google Search Console.
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-white p-10 text-center">
        <p className="font-semibold text-navy-900">Chưa kết nối Google Search Console</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink/55">
          Phần này sẽ hiển thị số liệu thật (lượt hiển thị, lượt nhấp, vị trí trung bình)
          sau khi kết nối Google Search Console cho falcoexpress.com.
        </p>
      </div>
    </div>
  );
}
