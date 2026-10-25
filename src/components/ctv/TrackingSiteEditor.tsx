"use client";

import { useEffect, useRef, useState } from "react";
import TrackingSiteView, { type SiteTheme, themeHex } from "@/components/tracking-site/TrackingSiteView";
import { TRACKING_COLORS, TRACKING_LAYOUTS } from "@/lib/tracking-site-config";
import type { TrackingSite } from "@/lib/ctv-portal";

type Form = Omit<SiteTheme, "has_logo" | "has_banner"> & { enabled: boolean };
type Pending = { file: File; url: string } | "remove" | null;

const input = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-navy-600";
const label = "mb-1.5 block text-xs font-semibold text-ink/55";
const card = "rounded-2xl border border-line bg-white p-5 shadow-sm";

// Hình phác thảo từng kiểu hiển thị (giống màn chọn kiểu của BayOnline).
function LayoutThumb({ kind, hex }: { kind: string; hex: string }) {
  const bar = { background: hex };
  const line = "h-1.5 rounded-full bg-black/10";
  return (
    <div className="h-14 w-full overflow-hidden rounded-lg border border-black/10 bg-[#f6f7f9] p-1.5">
      {kind === "split" && (
        <div className="flex h-full gap-1">
          <div className="w-2/5 rounded" style={bar} />
          <div className="flex flex-1 flex-col justify-center gap-1"><div className={line} /><div className={line} /></div>
        </div>
      )}
      {kind === "bold" && (
        <div className="flex h-full flex-col gap-1">
          <div className="h-1/2 rounded" style={bar} />
          <div className={line} />
        </div>
      )}
      {kind === "card" && (
        <div className="relative h-full">
          <div className="h-1/2 rounded" style={bar} />
          <div className="absolute inset-x-1.5 top-[40%] h-1/2 rounded-md bg-white shadow" />
        </div>
      )}
      {kind === "minimal" && (
        <div className="flex h-full flex-col items-center justify-center gap-1.5"><div className="h-1.5 w-6 rounded-full" style={bar} /><div className="h-3 w-4/5 rounded border border-black/10 bg-white" /></div>
      )}
      {kind === "classic" && (
        <div className="flex h-full flex-col gap-1">
          <div className="h-2.5 rounded bg-white" />
          <div className="mx-auto h-3 w-4/5 rounded border border-black/10 bg-white" />
          <div className="mx-auto h-1.5 w-3/5 rounded-full" style={bar} />
        </div>
      )}
    </div>
  );
}

function ImagePicker({
  title,
  hint,
  currentUrl,
  pending,
  onPick,
  onRemove,
}: {
  title: string;
  hint: string;
  currentUrl: string | null;
  pending: Pending;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const shown = pending && pending !== "remove" ? pending.url : pending === "remove" ? null : currentUrl;
  return (
    <div>
      <span className={label}>{title}</span>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3">
        <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-mist">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-ink/35">Chưa có</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink/50">{hint}</p>
          <div className="mt-1.5 flex gap-2">
            <button type="button" onClick={() => ref.current?.click()} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-mist">
              Chọn ảnh
            </button>
            {shown && (
              <button type="button" onClick={onRemove} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                Xoá
              </button>
            )}
          </div>
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export default function TrackingSiteEditor({
  initial,
  baseDomain,
  defaults,
}: {
  initial: TrackingSite | null;
  baseDomain: string;
  defaults: { display_name: string; phone: string };
}) {
  const start: Form = {
    slug: initial?.slug ?? "",
    display_name: initial?.display_name ?? defaults.display_name,
    layout: initial?.layout ?? "classic",
    color: initial?.color ?? "ocean",
    custom_color: initial?.custom_color ?? null,
    zalo: initial?.zalo ?? null,
    whatsapp: initial?.whatsapp ?? null,
    facebook: initial?.facebook ?? null,
    email: initial?.email ?? null,
    phone: initial?.phone ?? (initial ? null : defaults.phone || null),
    address: initial?.address ?? null,
    enabled: initial?.enabled ?? true,
  };
  const [saved, setSaved] = useState<TrackingSite | null>(initial);
  const [form, setForm] = useState<Form>(start);
  const [dirty, setDirty] = useState(!initial);
  const [logo, setLogo] = useState<Pending>(null);
  const [banner, setBanner] = useState<Pending>(null);
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [screen, setScreen] = useState<"home" | "result">("home");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const [rev, setRev] = useState(0); // đổi sau mỗi lần lưu để ảnh trong preview nạp lại
  useEffect(() => setOrigin(window.location.origin), []);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((p) => ({ ...p, [k]: v }));
    setDirty(true);
  }
  const text = (k: "display_name" | "zalo" | "whatsapp" | "facebook" | "email" | "phone" | "address") => ({
    value: form[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never),
  });

  const pick = (kind: "logo" | "banner") => (f: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return setMsg({ ok: false, text: "Chỉ nhận ảnh PNG, JPG hoặc WebP" });
    if (f.size > 1024 * 1024) return setMsg({ ok: false, text: "Ảnh tối đa 1MB" });
    setMsg(null);
    (kind === "logo" ? setLogo : setBanner)({ file: f, url: URL.createObjectURL(f) });
    setDirty(true);
  };
  const remove = (kind: "logo" | "banner") => () => {
    (kind === "logo" ? setLogo : setBanner)("remove");
    setDirty(true);
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ctv/tracking-site", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Không lưu được");
      for (const [kind, p] of [["logo", logo], ["banner", banner]] as const) {
        if (!p) continue;
        if (p === "remove") {
          await fetch(`/api/ctv/tracking-site/image?kind=${kind}`, { method: "DELETE" });
        } else {
          const fd = new FormData();
          fd.append("kind", kind);
          fd.append("file", p.file);
          const r = await fetch("/api/ctv/tracking-site/image", { method: "POST", body: fd });
          if (!r.ok) throw new Error((await r.json()).error ?? "Không tải được ảnh");
        }
      }
      const fresh = await fetch("/api/ctv/tracking-site").then((r) => r.json());
      setSaved(fresh.site);
      setLogo(null);
      setBanner(null);
      setRev((v) => v + 1);
      setDirty(false);
      setMsg({ ok: true, text: "Đã lưu theme." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const hex = themeHex(form);
  const savedLogo = saved?.has_logo ? `/api/t/${saved.slug}/asset/logo?v=${rev}` : null;
  const savedBanner = saved?.has_banner ? `/api/t/${saved.slug}/asset/banner?v=${rev}` : null;
  const logoUrl = logo && logo !== "remove" ? logo.url : logo === "remove" ? null : savedLogo;
  const bannerUrl = banner && banner !== "remove" ? banner.url : banner === "remove" ? null : savedBanner;
  const theme: SiteTheme = { ...form, slug: form.slug || "xem-truoc", has_logo: !!logoUrl, has_banner: !!bannerUrl };
  const host = baseDomain ? `${baseDomain}/${form.slug || "ten-cua-ban"}` : `${origin.replace(/^https?:\/\//, "") || "…"}/t/${form.slug || "ten-cua-ban"}`;
  const publicUrl = saved ? (baseDomain ? `https://${baseDomain}/${saved.slug}` : `${origin}/t/${saved.slug}`) : "";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className={card}>
          <h2 className="font-semibold text-navy-900">Đường dẫn trang</h2>
          <div className="mt-3 flex items-center gap-2">
            <span className="shrink-0 text-sm text-ink/50">{baseDomain ? `${baseDomain}/` : "/t/"}</span>
            <input className={input} placeholder="ten-cua-ban" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
          </div>
          {saved && (
            <p className="mt-2 text-xs text-ink/55">
              Link gửi khách:{" "}
              <a href={baseDomain ? publicUrl : `/t/${saved.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-800 underline">
                {publicUrl}
              </a>
            </p>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm text-ink/80">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-4 w-4 rounded" /> Bật trang tra cứu
          </label>
        </div>

        <div className={card}>
          <h2 className="font-semibold text-navy-900">Kiểu hiển thị</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {TRACKING_LAYOUTS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => set("layout", l.value)}
                className={`rounded-xl border-2 p-2 text-left transition-colors ${form.layout === l.value ? "border-navy-800 bg-navy-50/50" : "border-transparent bg-mist/60 hover:border-line"}`}
              >
                <LayoutThumb kind={l.value} hex={hex} />
                <span className="mt-1.5 block text-center text-xs font-semibold text-ink/75">{l.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={card}>
          <h2 className="font-semibold text-navy-900">Màu</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {TRACKING_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => set("color", c.value)}
                className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm transition-colors ${form.color === c.value ? "border-navy-800 font-semibold text-navy-900" : "border-transparent bg-mist/60 text-ink/65 hover:border-line"}`}
              >
                <span className="h-4 w-4 rounded-full" style={{ background: c.hex }} /> {c.label}
              </button>
            ))}
            <label className={`flex cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm ${form.color === "custom" ? "border-navy-800 font-semibold" : "border-transparent bg-mist/60 text-ink/65"}`}>
              Màu riêng
              <input
                type="color"
                value={form.custom_color ?? hex}
                onChange={(e) => {
                  setForm((p) => ({ ...p, custom_color: e.target.value, color: "custom" }));
                  setDirty(true);
                }}
                className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>
          </div>
        </div>

        <div className={card}>
          <h2 className="font-semibold text-navy-900">Nhận diện</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label className={label}>Tên hiển thị (tối đa 80 ký tự)</label>
              <input className={input} maxLength={80} {...text("display_name")} />
            </div>
            <ImagePicker title="Logo" hint="PNG/JPG/WebP, tối đa 1MB" currentUrl={savedLogo} pending={logo} onPick={pick("logo")} onRemove={remove("logo")} />
            <ImagePicker title="Banner" hint="1200 × 400 px, tối đa 1MB" currentUrl={savedBanner} pending={banner} onPick={pick("banner")} onRemove={remove("banner")} />
          </div>
        </div>

        <div className={card}>
          <h2 className="font-semibold text-navy-900">Liên hệ</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Zalo (số điện thoại hoặc link)</label><input className={input} {...text("zalo")} /></div>
            <div><label className={label}>WhatsApp (số điện thoại)</label><input className={input} {...text("whatsapp")} /></div>
            <div><label className={label}>Facebook (link)</label><input className={input} {...text("facebook")} /></div>
            <div><label className={label}>Email</label><input className={input} {...text("email")} /></div>
            <div><label className={label}>Số điện thoại</label><input className={input} {...text("phone")} /></div>
            <div><label className={label}>Địa chỉ</label><input className={input} {...text("address")} /></div>
          </div>
        </div>

        <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur">
          <button type="button" onClick={save} disabled={busy || !form.slug} className="rounded-xl bg-navy-800 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-navy-900 disabled:opacity-50">
            {busy ? "Đang lưu…" : "Lưu theme"}
          </button>
          {msg ? (
            <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</span>
          ) : !form.slug ? (
            <span className="text-sm text-amber-600">Nhập đường dẫn trang ở trên để lưu</span>
          ) : dirty ? (
            <span className="text-sm text-amber-600">Có thay đổi chưa lưu</span>
          ) : (
            <span className="text-sm text-ink/45">Đã lưu</span>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-4">
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-navy-900">Xem trước</h2>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(["home", "result"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setScreen(s)} className={`rounded-full px-3 py-1.5 font-semibold ${screen === s ? "bg-navy-800 text-white" : "bg-mist text-ink/60"}`}>
                  {s === "home" ? "Trang chủ" : "Kết quả"}
                </button>
              ))}
              {(["phone", "desktop"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDevice(d)} className={`rounded-full px-3 py-1.5 font-semibold ${device === d ? "bg-navy-800 text-white" : "bg-mist text-ink/60"}`}>
                  {d === "phone" ? "Điện thoại" : "Máy tính"}
                </button>
              ))}
            </div>
          </div>
          <div className={`mx-auto mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-sm ${device === "phone" ? "max-w-[390px]" : "w-full"}`}>
            <div className="flex items-center gap-2 border-b border-line bg-mist px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 min-w-0 flex-1 truncate rounded-full bg-white px-3 py-1 text-[11px] text-ink/50">{host}</span>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              <TrackingSiteView theme={theme} preview previewMode={screen} logoUrl={logoUrl} bannerUrl={bannerUrl} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
