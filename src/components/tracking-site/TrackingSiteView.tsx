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
    <form onSubmit={search} className="flex w-full max-w-xl gap-2">
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
          <h1 className="text-2xl font-extrabold text-black/85 sm:text-3xl">Tra cứu đơn hàng cùng {theme.display_name || "chúng tôi"}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-black/55">Nhập mã tra cứu để xem trạng thái và hành trình vận chuyển đơn hàng của bạn.</p>
        </div>
      )}
    </>
  );

  const footer = (theme.email || theme.phone || theme.address) && (
    <footer className="mt-10 border-t border-black/10 py-6 text-center text-xs text-black/55">
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
        {theme.phone && <a href={link(theme.phone, "phone")!}>{theme.phone}</a>}
        {theme.email && <a href={link(theme.email, "email")!}>{theme.email}</a>}
        {theme.address && <span>{theme.address}</span>}
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

  // classic
  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4" style={{ color: hex }}>
          {brand}
          <span className="text-black/70">{socialLinks}</span>
        </div>
      </header>
      {bannerEl}
      <main className="mx-auto max-w-3xl px-5 py-8 text-center">
        <div className="flex justify-center">{form}</div>
        {body}
        {footer}
      </main>
    </div>
  );
}
