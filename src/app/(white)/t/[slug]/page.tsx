import type { Metadata } from "next";
import { getTrackingSiteBySlug } from "@/lib/ctv-portal";
import TrackingSiteView from "@/components/tracking-site/TrackingSiteView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string }> };

// Trang công khai mang thương hiệu CTV: tiêu đề tab = tên CTV, không chỉ mục, tuyệt đối không nhắc Falco.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await getTrackingSiteBySlug((await params).slug);
  const name = site?.display_name || "Tra cứu đơn hàng";
  const description = `Tra cứu trạng thái và hành trình đơn hàng cùng ${site?.display_name || "chúng tôi"}.`;
  return {
    // Ghi đè TOÀN BỘ metadata kế thừa từ layout gốc (Falco): tên, mô tả, từ khoá, OG, xác minh, icon.
    title: { absolute: name },
    description,
    keywords: null,
    openGraph: { title: name, description, siteName: name, type: "website", locale: "vi_VN" },
    twitter: { title: name, description },
    verification: { google: null },
    robots: { index: false, follow: false },
    icons: { icon: site?.has_logo ? `/api/t/${site.slug}/asset/logo` : "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" },
  };
}

export default async function TrackingSitePage({ params, searchParams }: Props) {
  const site = await getTrackingSiteBySlug((await params).slug);
  if (!site || !site.enabled) {
    // Không dùng notFound(): trang 404 mặc định mang thương hiệu Falco.
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5 text-center">
        <div>
          <h1 className="text-2xl font-extrabold text-black/80">Trang không tồn tại</h1>
          <p className="mt-2 text-sm text-black/55">Đường dẫn này không còn hoạt động. Vui lòng liên hệ nơi bạn gửi hàng để lấy link mới.</p>
        </div>
      </div>
    );
  }
  const { code } = await searchParams;
  return <TrackingSiteView theme={site} initialCode={code ?? ""} />;
}
