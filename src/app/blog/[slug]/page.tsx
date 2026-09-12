import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog-posts";
import { resolveMetadataOverride } from "@/lib/seo";
import { COUNTRY_ROUTES, SITE } from "@/lib/constants";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import CTABanner from "@/components/CTABanner";
import { ArrowRightIcon, CheckCircleIcon } from "@/components/icons";

/**
 * Route ĐỘNG blog/[slug] — folder tên chỉ có "[slug]", KHÔNG ghép chữ
 * thường với ngoặc vuông trong cùng 1 tên thư mục (khác với lỗi cũ ở
 * gui-hang-di-[slug] đã gặp 404 vì folder tên "gui-hang-di-[slug]").
 * generateStaticParams bên dưới để Next.js prerender từng bài thành HTML
 * tĩnh ở build time. Nếu sau khi deploy vẫn 404 giống sự cố trước, xem
 * ghi chú trong seo-workflow-falco-express.md — bước khắc phục là tách
 * mỗi bài blog ra một thư mục tĩnh riêng (ví dụ
 * src/app/blog-ten-bai-viet/page.tsx) như đã làm với các trang tuyến.
 */
export const revalidate = 300;

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return resolveMetadataOverride(`/blog/${post.slug}`, {
    title: post.metaTitle,
    description: post.metaDescription,
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <>
      <PageHero eyebrow="Blog Falco Express" title={post.title} description={post.excerpt} />

      <section className="section">
        <div className="container-page max-w-3xl">
          <Reveal>
            <div className="space-y-6">
              {post.content.map((block, i) => {
                if (block.type === "h2") {
                  return (
                    <h2
                      key={i}
                      className="mt-2 text-xl font-extrabold leading-snug text-navy-900 sm:text-2xl"
                    >
                      {block.text}
                    </h2>
                  );
                }
                if (block.type === "p") {
                  return (
                    <p key={i} className="text-sm leading-relaxed text-ink/75 sm:text-base">
                      {block.text}
                    </p>
                  );
                }
                if (block.type === "list") {
                  return (
                    <ul key={i} className="space-y-2.5">
                      {block.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 text-sm leading-relaxed text-ink/75 sm:text-base"
                        >
                          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === "note") {
                  return (
                    <p
                      key={i}
                      className="rounded-2xl border border-line bg-mist p-4 text-xs leading-relaxed text-ink/55 sm:text-sm"
                    >
                      {block.text}
                    </p>
                  );
                }
                return null;
              })}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/lien-he" className="btn-primary">
                Nhận tư vấn gửi hàng
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <a
                href={SITE.zaloHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                Chat Zalo tư vấn ngay
              </a>
            </div>
          </Reveal>

          <div className="mt-14 border-t border-line pt-8">
            <span className="eyebrow">Các tuyến gửi hàng</span>
            <div className="mt-4 flex flex-wrap gap-3">
              {COUNTRY_ROUTES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/gui-hang-di-${c.slug}`}
                  className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy-800 transition hover:border-flame-400"
                >
                  Gửi hàng đi {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
