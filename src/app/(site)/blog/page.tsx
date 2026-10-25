import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { resolveMetadataOverride } from "@/lib/seo";
import { ArrowRightIcon } from "@/components/icons";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return resolveMetadataOverride("/blog", {
    title: "Blog Falco Express – Kinh nghiệm gửi hàng đi châu Âu",
    description:
      "Kinh nghiệm thực tế gửi hàng, thực phẩm, quà từ Việt Nam sang Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan: thủ tục hải quan, đóng gói, mẹo gửi hàng từ Falco Express.",
  });
}

const sortedPosts = [...BLOG_POSTS].sort(
  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
);

export default function BlogIndexPage() {
  return (
    <>
      <PageHero
        eyebrow="Blog Falco Express"
        title="Kinh nghiệm gửi hàng đi châu Âu"
        description="Hải quan, đóng gói, mẹo gửi hàng thực tế cho người Việt đang gửi quà, thực phẩm, đồ dùng cho người thân, du học sinh ở Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan."
      />
      <section className="section">
        <div className="container-page">
          {sortedPosts.length === 0 ? (
            <p className="text-sm text-ink/60">Chưa có bài viết nào.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {sortedPosts.map((post, i) => (
                <Reveal key={post.slug} delay={i * 0.05}>
                  <Link href={`/blog/${post.slug}`} className="card block h-full p-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-flame-600">
                      {new Date(post.publishedAt).toLocaleDateString("vi-VN")}
                    </p>
                    <h2 className="mt-3 text-lg font-extrabold leading-snug text-navy-900">
                      {post.title}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-ink/65">{post.excerpt}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-flame-600">
                      Đọc tiếp
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
