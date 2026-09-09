import Image from "next/image";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 bg-mist">
      <Image
        src="/falco-logo.png"
        alt="Falco Express"
        width={48}
        height={48}
        className="h-12 w-12 animate-pulse rounded-full ring-1 ring-line"
        priority
      />
      <p className="text-sm font-medium text-ink/50">Đang tải...</p>
    </div>
  );
}
