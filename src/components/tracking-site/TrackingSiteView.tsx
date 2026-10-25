"use client";

import { useState } from "react";
import type { TrackingSite } from "@/lib/ctv-portal";
import { TRACKING_COLORS } from "@/lib/tracking-site-config";

// Giao diện tra cứu mang thương hiệu CTV. Dùng cho cả trang công khai /t/<slug> và khung xem trước
// trong cổng CTV. KHÔNG có logo/tên/hotline Falco ở bất kỳ đâu.

type Step = { title: string; time: string; location: string | null };
type Parcel = { hawb: string; trackingCode: string; status: string; trackingUrl: string | null; carrier: string };
export type SiteResult = {
  falcoCode: string;
  recipientName: string;
  service: string;
  destination: string;
  currentStatus: string;
  steps: Step[];
  parcels: Parcel[];
  photos?: { label: string; time: string }[];
};

export type SiteTheme = Pick<
  TrackingSite,
  "slug" | "display_name" | "layout" | "color" | "custom_color" | "zalo" | "whatsapp" | "facebook" | "email" | "phone" | "address" | "has_logo" | "has_banner"
>;

export const SAMPLE_RESULT: SiteResult = {
  falcoCode: "FL261025001",
  recipientName: "Nguyen Van A",
  service: "Hàng khô",
  destination: "Berlin, Đức",
  currentStatus: "Đang vận chuyển bằng đường hàng không",
  steps: [
    { title: "Đang vận chuyển bằng đường hàng không", time: "2026-10-25 07:00:17", location: null },
    { title: "Đã cân hàng", time: "2026-10-24 11:27:14", location: null },
    { title: "Đã kiểm hàng", time: "2026-10-24 11:09:23", location: null },
    { title: "Đã tạo đơn", time: "2026-10-24 10:53:58", location: null },
  ],
  parcels: [{ hawb: "", trackingCode: "00340434791627578941", status: "", trackingUrl: null, carrier: "DHL" }],
};

export function themeHex(t: Pick<SiteTheme, "color" | "custom_color">): string {
  if (t.color === "custom" && t.custom_color) return t.custom_color;
  return TRACKING_COLORS.find((c) => c.value === t.color)?.hex ?? "#0e7490";
}

const link = (v: string | null, kind: "zalo" | "whatsapp" | "facebook" | "email" | "phone"): string | null => {
  if (!v) return null;
  const s = v.trim();
  if (kind === "email") return `mailto:${s}`;
  if (kind === "phone") return `tel:${s.replace(/\s/g, "")}`;
  if (/^https?:\/\//i.test(s)) return s;
  const digits = s.replace(/[^\d+]/g, "");
  if (kind === "zalo") return `https://zalo.me/${digits.replace("+", "")}`;
  if (kind === "whatsapp") return `https://wa.me/${digits.replace("+", "")}`;
  return `https://facebook.com/${s.replace(/^@/, "")}`;
};

function Ico({ d, small }: { d: string; small?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={small ? 22 : 28} height={small ? 22 : 28} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Results({ result, hex, slug, preview }: { result: SiteResult; hex: string; slug: string; preview: boolean }) {
  const [showPhotos, setShowPhotos] = useState(false);
  return (
    <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 text-left shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-black/45">Mã vận đơn</p>
          <p className="text-xl font-extrabold text-black/85">{result.falcoCode}</p>
        </div>
        <span className="rounded-lg px-3 py-1.5 text-sm font-bold text-white" style={{ background: hex }}>
          {result.currentStatus}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {[
          ["Người nhận", result.recipientName],
          ["Dịch vụ", result.service],
          ["Điểm đến", result.destination],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-black/45">{k}</dt>
            <dd className="font-semibold text-black/80">{v || "—"}</dd>
          </div>
        ))}
      </dl>

      {result.steps.length > 0 && (
        <ol className="mt-5 space-y-4 border-l-2 pl-4" style={{ borderColor: `${hex}55` }}>
          {result.steps.map((s, i) => (
            <li key={i} className="relative">
              <span
                className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white"
                style={{ background: i === 0 ? hex : "#cbd5e1" }}
              />
              <p className="text-sm font-semibold text-black/85">{s.title}</p>
              <p className="text-xs text-black/50">
                {s.time}
                {s.location ? ` · ${s.location}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}

      {result.photos && result.photos.length > 0 && !preview && (
        <div className="mt-5 border-t border-black/10 pt-4">
          <button type="button" onClick={() => setShowPhotos((v) => !v)} className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold text-black/75">
            {showPhotos ? "Ẩn hình ảnh hàng" : `Xem hình ảnh hàng (${result.photos.length})`}
          </button>
          {showPhotos && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {result.photos.map((p, i) => {
                const src = `/api/t/${slug}/photo?code=${encodeURIComponent(result.falcoCode)}&n=${i}`;
                return (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={p.label} loading="lazy" className="aspect-square w-full rounded-xl border border-black/10 object-cover" />
                    <span className="mt-1 block text-xs text-black/55">{p.label}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {result.parcels.length > 0 && (
        <div className="mt-5 border-t border-black/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-black/45">Mã vận đơn chặng cuối</p>
          {result.parcels.map((p) => (
            <div key={p.trackingCode} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[0.04] p-3">
              <div>
                <p className="font-bold text-black/80">{p.trackingCode}</p>
                {p.carrier && <p className="text-xs text-black/50">{p.carrier}</p>}
              </div>
              {p.trackingUrl && (
                <a href={p.trackingUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: hex }}>
                  Tra cứu tại {p.carrier || "hãng vận chuyển"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TrackingSiteView({
  theme,
  preview = false,
  previewMode = "home",
  initialCode = "",
  logoUrl,
  bannerUrl,
}: {
  theme: SiteTheme;
  preview?: boolean;
  previewMode?: "home" | "result";
  initialCode?: string;
  /** Ghi đè địa chỉ logo/banner (khung xem trước hiện ảnh vừa chọn trước khi lưu). null = không có ảnh. */
  logoUrl?: string | null;
  bannerUrl?: string | null;
}) {
  const hex = themeHex(theme);
  const tint = `${hex}1c`; // nền nhạt cùng tông màu chủ đạo
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<SiteResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const name = theme.display_name || "Tra cứu đơn hàng";
  const logo = logoUrl !== undefined ? logoUrl : theme.has_logo ? `/api/t/${theme.slug}/asset/logo` : null;
  const banner = bannerUrl !== undefined ? bannerUrl : theme.has_banner ? `/api/t/${theme.slug}/asset/banner` : null;

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (preview || !code.trim()) return;
    setState("loading");
    setError("");
    setNotFound(false);
    setResult(null);
    try {
      const res = await fetch(`/api/t/${theme.slug}/track?code=${encodeURIComponent(code.trim())}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Không thể tra cứu lúc này");
      if (j.found) setResult(j.data as SiteResult);
      else setNotFound(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setState("done");
    }
  }

  const shown = preview ? (previewMode === "result" ? SAMPLE_RESULT : null) : result;

  const socials = (
    [
      ["Zalo", link(theme.zalo, "zalo")],
      ["WhatsApp", link(theme.whatsapp, "whatsapp")],
      ["Facebook", link(theme.facebook, "facebook")],
    ] as const
  ).filter(([, href]) => href);

  const brand = (
    <span className="flex items-center gap-2.5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="h-9 w-auto max-w-[140px] object-contain" />
      ) : null}
      {(!logo || theme.display_name) && <span className="text-lg font-extrabold">{theme.display_name || "Tra cứu đơn hàng"}</span>}
    </span>
  );

  const form = (
    <form onSubmit={search} className="flex w-full max-w-3xl gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Nhập mã tra cứu"
        aria-label="Mã tra cứu"
        className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 text-sm text-black/80 outline-none focus:border-black/40"
      />
      <button type="submit" disabled={state === "loading"} className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ background: hex }}>
        {state === "loading" ? "Đang tra…" : "Tra cứu"}
      </button>
    </form>
  );

  const body = (
    <>
      {shown && <Results result={shown} hex={hex} slug={theme.slug} preview={preview} />}
      {!preview && state === "done" && notFound && (
        <p className="mt-6 rounded-xl bg-white p-5 text-center text-sm text-black/70 shadow-sm">
          Không tìm thấy đơn &ldquo;{code}&rdquo;. Vui lòng kiểm tra lại mã hoặc liên hệ nơi bạn gửi hàng.
        </p>
      )}
      {!preview && error && <p className="mt-6 text-center text-sm text-rose-600">{error}</p>}
      {!shown && !notFound && !error && (
        <div className="mt-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: tint, color: hex }}>
            <Ico d="M21 8.5V16a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8.5a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4a2 2 0 0 1 1 1.7ZM3.3 7.5 12 12.5l8.7-5M12 22.5v-10" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-black/85 sm:text-3xl">Tra cứu đơn hàng cùng {theme.display_name || "chúng tôi"}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-black/55">Nhập mã tra cứu để xem trạng thái và hành trình vận chuyển đơn hàng của bạn.</p>

          <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
            {[
              ["Nhập mã", "Điền mã tra cứu vào ô tìm kiếm phía trên.", "M4 6h16M4 12h16M4 18h10"],
              ["Xem hành trình", "Theo dõi từng mốc vận chuyển của đơn hàng.", "M12 21s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
              ["Nhận hàng", "Nắm tình trạng để chủ động nhận hàng.", "M20 7 9 18l-5-5"],
            ].map(([t, d, ic], i) => (
              <div key={t} className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: hex }}>{i + 1}</span>
                  <span style={{ color: hex }}><Ico d={ic} small /></span>
                </div>
                <p className="mt-3 font-bold text-black/80">{t}</p>
                <p className="mt-1 text-sm text-black/55">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 text-left sm:grid-cols-3">
            {[
              ["Bản đồ hành trình", "Tuyến vận chuyển hiển thị trực quan trên bản đồ.", "M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7 9 4Zm0 0v13m6-10v12.5"],
              ["Trạng thái cập nhật", "Biết đơn đang ở bước nào, cập nhật theo thời gian thực.", "M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Zm4.5 11a1.8 1.8 0 0 0 3 0"],
              ["Hình ảnh xử lý", "Xem ảnh kiện hàng ở các bước nhận, cân và đóng gói.", "M4 5h16v14H4V5Zm0 11 4.5-4.5L13 16l3-3 4 4M9 9.5h.01"],
            ].map(([t, d, ic]) => (
              <div key={t} className="rounded-2xl p-4" style={{ background: tint }}>
                <span style={{ color: hex }}><Ico d={ic} small /></span>
                <p className="mt-3 font-bold text-black/80">{t}</p>
                <p className="mt-1 text-sm text-black/55">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-black/45">Chưa có mã tra cứu? Liên hệ {theme.display_name || "nơi bạn gửi hàng"} qua các kênh ở đầu và cuối trang để được hỗ trợ.</p>
        </div>
      )}
    </>
  );

  const footer = (theme.email || theme.phone || theme.address) && (
    <footer className="mt-10 rounded-2xl px-5 py-5" style={{ background: tint }}>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {[
          theme.address && ["Địa chỉ", theme.address, null, "M12 21s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
          theme.phone && ["Số điện thoại", theme.phone, link(theme.phone, "phone"), "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"],
          theme.email && ["Email", theme.email, link(theme.email, "email"), "M4 6h16v12H4V6Zm0 1 8 6 8-6"],
        ]
          .filter(Boolean)
          .map((x) => {
            const [k, v, href, ic] = x as [string, string, string | null, string];
            return (
              <div key={k} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white" style={{ color: hex }}>
                  <Ico d={ic} small />
                </span>
                <div className="text-left">
                  <p className="text-xs text-black/45">{k}</p>
                  {href ? <a href={href} className="font-semibold text-black/80">{v}</a> : <p className="font-semibold text-black/80">{v}</p>}
                </div>
              </div>
            );
          })}
      </div>
    </footer>
  );

  const socialLinks = socials.length > 0 && (
    <nav className="flex gap-3 text-sm font-semibold">
      {socials.map(([label, href]) => (
        <a key={label} href={href!} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
          {label}
        </a>
      ))}
    </nav>
  );

  const bannerEl = banner && theme.layout !== "minimal" && (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={banner} alt="" className="h-28 w-full object-cover sm:h-40" />
  );

  if (theme.layout === "bold") {
    return (
      <div className="min-h-screen bg-[#f6f7f9]">
        <header className="px-5 py-5 text-white" style={{ background: hex }}>
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <div className="flex items-center justify-between">
              {brand}
              <span className="text-white">{socialLinks}</span>
            </div>
            <div className="[&_input]:border-white/30">{form}</div>
          </div>
        </header>
        {bannerEl}
        <main className="mx-auto max-w-3xl px-5">{body}{footer}</main>
      </div>
    );
  }

  if (theme.layout === "split") {
    return (
      <div className="min-h-screen bg-[#f6f7f9] md:grid md:grid-cols-[360px_1fr]">
        <aside className="flex flex-col justify-between gap-8 px-6 py-8 text-white" style={{ background: hex }}>
          <div className="space-y-6">
            {brand}
            <p className="text-sm text-white/85">Nhập mã tra cứu để xem trạng thái và hành trình đơn hàng.</p>
            <div className="[&_form]:flex-col [&_input]:w-full [&_button]:bg-white [&_button]:!text-black/80">{form}</div>
          </div>
          <div className="text-white">{socialLinks}</div>
        </aside>
        <main className="px-5 pb-10 md:px-10">
          {bannerEl}
          {body}
          {footer}
        </main>
      </div>
    );
  }

  if (theme.layout === "card") {
    return (
      <div className="min-h-screen bg-[#f6f7f9]">
        <div className="px-5 pb-24 pt-6 text-white" style={{ background: hex }}>
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            {brand}
            {socialLinks}
          </div>
        </div>
        <main className="mx-auto -mt-16 max-w-3xl px-5">
          <div className="rounded-2xl bg-white p-5 shadow-lg">
            <div className="flex justify-center">{form}</div>
          </div>
          {bannerEl && <div className="mt-4 overflow-hidden rounded-2xl">{bannerEl}</div>}
          {body}
          {footer}
        </main>
      </div>
    );
  }

  if (theme.layout === "minimal") {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto max-w-2xl px-5 py-10 text-center">
          <div className="mb-8 flex items-center justify-center" style={{ color: hex }}>
            {brand}
          </div>
          <div className="flex justify-center">{form}</div>
          {body}
          <div className="mt-6 flex justify-center">{socialLinks}</div>
          {footer}
        </main>
      </div>
    );
  }

  // classic — dải màu nhạt: tên bên trái, nhãn bên phải, ô tra cứu ngay trong dải (giống mẫu BayOnline)
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-b-2xl px-5 pb-5 pt-5 sm:px-8" style={{ background: tint }}>
          <div className="flex items-center justify-between" style={{ color: "#111" }}>
            {brand}
            <span className="flex items-center gap-4 text-sm text-black/50">
              {socialLinks}
              <span className="hidden sm:inline">Tra cứu đơn hàng</span>
            </span>
          </div>
          <div className="mt-4">{form}</div>
        </header>
        {bannerEl}
        <main className="px-5 pb-10 text-center sm:px-8">
          {body}
          {footer}
        </main>
      </div>
    </div>
  );
}
