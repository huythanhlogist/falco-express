import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <section className="section flex min-h-[60vh] items-center">
      <div className="container-page text-center">
        <p className="font-display text-6xl font-extrabold text-flame-500">404</p>
        <h1 className="mt-4 text-2xl font-extrabold text-navy-900">
          Không tìm thấy trang bạn yêu cầu
        </h1>
        <p className="mx-auto mt-3 max-w-md text-ink/60">
          Trang bạn tìm kiếm có thể đã bị xoá hoặc không tồn tại. Hãy quay lại
          trang chủ để tiếp tục.
        </p>
        <Link href="/" className="btn-primary mt-7 inline-flex">
          Về trang chủ
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
