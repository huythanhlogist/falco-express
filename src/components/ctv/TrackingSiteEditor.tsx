"use client";

import { useEffect, useState } from "react";
import TrackingSiteView, { type SiteTheme, themeHex } from "@/components/tracking-site/TrackingSiteView";
import { TRACKING_COLORS, TRACKING_LAYOUTS } from "@/lib/tracking-site-config";
import type { TrackingSite } from "@/lib/ctv-portal";

type Form = Omit<SiteTheme, "has_logo" | "has_banner"> & { enabled: boolean };

const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";
const lbl = "mb-1 block text-xs font-semibold text-ink/55";

export default function TrackingSiteEditor({
  initial,
  baseDomain,
  defaults,
}: {
  initial: TrackingSite | null;
  baseDomain: string;
  defaults: { display_name: string; phone: string };
}) {
  const [saved, setSaved] = useState<TrackingSite | null>(initial);
  const [form, setForm] = useState<Form>({
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
  });
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [screen, setScreen] = useState<"home" | "result">("home");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [imgVersion, setImgVersion] = useState(0);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));
  const text = (k: "display_name" | "zalo" | "whatsapp" | "facebook" | "email" | "phone" | "address") => ({
    value: form[k] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never),
  });

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/ctv/tracking-site", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Không lưu được");
      setSaved(j.site);
      setMsg("Đã lưu theme.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: "logo" | "banner", file: File | null) {
    if (!file) return;
    setMsg("");
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    const res = await fetch("/api/ctv/tracking-site/image", { method: "POST", body: fd });
    const j = await res.json();
    if (!res.ok) return setMsg(j.error ?? "Không tải được ảnh");
    setSaved((s) => (s ? { ...s, [kind === "logo" ? "has_logo" : "has_banner"]: true } : s));
    setImgVersion((v) => v + 1);
  }

  async function removeImage(kind: "logo" | "banner") {
    await fetch(`/api/ctv/tracking-site/image?kind=${kind}`, { method: "DELETE" });
    setSaved((s) => (s ? { ...s, [kind === "logo" ? "has_logo" : "has_banner"]: false } : s));
    setImgVersion((v) => v + 1);
  }

  const theme: SiteTheme = { ...form, slug: form.slug || "xem-truoc", has_logo: !!saved?.has_logo, has_banner: !!saved?.has_banner };
  const publicUrl = saved ? (baseDomain ? `https://${saved.slug}.${baseDomain}` : `${origin}/t/${saved.slug}`) : "";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-5 rounded-xl border border-line bg-white p-5">
        <section>
          <h2 className="font-semibold text-navy-900">Đường dẫn trang</h2>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-ink/50">{baseDomain ? "" : "/t/"}</span>
            <input className={field} placeholder="ten-cua-ban" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} />
            {baseDomain && <span className="shrink-0 text-sm text-ink/50">.{baseDomain}</span>}
          </div>
          {saved && (
            <p className="mt-2 text-xs text-ink/55">
              Link gửi khách: <a href={baseDomain ? publicUrl : `/t/${saved.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-800 underline">{publicUrl}</a>
            </p>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Bật trang tra cứu
          </label>
        </section>

        <section>
          <h2 className="font-semibold text-navy-900">Kiểu hiển thị</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {TRACKING_LAYOUTS.map((l) => (
              <button key={l.value} type="button" onClick={() => set("layout", l.value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${form.layout === l.value ? "border-navy-800 bg-navy-50 text-navy-900" : "border-line text-ink/60"}`}>
                {l.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-navy-900">Màu</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {TRACKING_COLORS.map((c) => (
              <button key={c.value} type="button" onClick={() => set("color", c.value)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${form.color === c.value ? "border-navy-800 font-semibold" : "border-line text-ink/60"}`}>
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: c.hex }} /> {c.label}
              </button>
            ))}
            <label className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${form.color === "custom" ? "border-navy-800 font-semibold" : "border-line text-ink/60"}`}>
              Màu riêng
              <input type="color" value={form.custom_color ?? themeHex(form)} onChange={(e) => { set("custom_color", e.target.value); set("color", "custom"); }} />
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-navy-900">Nhận diện</h2>
          <div>
            <label className={lbl}>Tên hiển thị (tối đa 80 ký tự)</label>
            <input className={field} maxLength={80} {...text("display_name")} />
          </div>
          {(["logo", "banner"] as const).map((kind) => (
            <div key={kind}>
              <label className={lbl}>{kind === "logo" ? "Logo" : "Banner (1200 × 400 px)"} — PNG/JPG/WebP, tối đa 1MB</label>
              {!saved ? (
                <p className="text-xs text-ink/45">Bấm &quot;Lưu theme&quot; trước, sau đó tải ảnh.</p>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(kind, e.target.files?.[0] ?? null)} className="text-xs" />
                  {(kind === "logo" ? saved.has_logo : saved.has_banner) && (
                    <button type="button" onClick={() => removeImage(kind)} className="text-xs text-rose-600">Xoá</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-navy-900">Liên hệ</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Zalo (số điện thoại hoặc link)</label><input className={field} {...text("zalo")} /></div>
            <div><label className={lbl}>WhatsApp (số điện thoại)</label><input className={field} {...text("whatsapp")} /></div>
            <div><label className={lbl}>Facebook (link)</label><input className={field} {...text("facebook")} /></div>
            <div><label className={lbl}>Email</label><input className={field} {...text("email")} /></div>
            <div><label className={lbl}>Số điện thoại</label><input className={field} {...text("phone")} /></div>
            <div><label className={lbl}>Địa chỉ</label><input className={field} {...text("address")} /></div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className="btn-primary !px-5 !py-2 text-sm">{busy ? "Đang lưu…" : "Lưu theme"}</button>
          {msg && <span className="text-sm text-ink/70">{msg}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-navy-900">Xem trước</h2>
          <div className="flex gap-2 text-sm">
            {(["home", "result"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setScreen(s)} className={`rounded-full px-3 py-1 ${screen === s ? "bg-navy-800 text-white" : "bg-mist text-ink/60"}`}>{s === "home" ? "Trang chủ" : "Kết quả"}</button>
            ))}
            {(["phone", "desktop"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDevice(d)} className={`rounded-full px-3 py-1 ${device === d ? "bg-navy-800 text-white" : "bg-mist text-ink/60"}`}>{d === "phone" ? "Điện thoại" : "Máy tính"}</button>
            ))}
          </div>
        </div>
        <div className={`mx-auto mt-4 overflow-hidden rounded-2xl border border-line ${device === "phone" ? "max-w-[390px]" : "w-full"}`}>
          <div className="max-h-[640px] overflow-y-auto" key={`${imgVersion}-${form.layout}`}>
            <TrackingSiteView theme={theme} preview previewMode={screen} />
          </div>
        </div>
      </div>
    </div>
  );
}
