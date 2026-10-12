import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-posts";
import SectionHeading from "./SectionHeading";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function BlogSection() {
  const posts = [...BLOG_POSTS]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);
  if (posts.length === 0) return null;

  return (
    <section className="lp-container pb-14 sm:pb-20 lg:pb-[100px]">
      <SectionHeading
        eyebrow="Cẩm nang"
        title="Kinh nghiệm gửi hàng đi Châu Âu & Anh"
        right={
          <Link
            href="/blog"
            className="hidden border-b-2 border-falco-accent pb-1 font-bold text-falco-navy hover:opacity-80 sm:inline-block"
          >
            Xem tất cả bài viết →
          </Link>
        }
      />
      <div className="mt-5 grid gap-4 sm:mt-10 sm:gap-6 md:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col border border-falco-border border-t-[3px] border-t-falco-accent bg-white p-5 transition-shadow hover:shadow-float sm:p-6"
          >
            <time dateTime={post.publishedAt} className="text-[13px] font-semibold text-falco-muted">
              {formatDate(post.publishedAt)}
            </time>
            <h3 className="mt-2 line-clamp-3 text-[17px] font-bold leading-snug text-falco-navy">{post.title}</h3>
            <p className="mt-2.5 line-clamp-3 text-[15px] text-falco-muted">{post.excerpt}</p>
            <span className="mt-4 text-sm font-bold text-falco-accent group-hover:underline">Đọc tiếp →</span>
          </Link>
        ))}
      </div>
      <Link href="/blog" className="mt-5 inline-block border-b-2 border-falco-accent pb-1 font-bold text-falco-navy sm:hidden">
        Xem tất cả bài viết →
      </Link>
    </section>
  );
}
