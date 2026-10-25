import { NextResponse } from "next/server";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import {
  TRACKING_COLORS,
  TRACKING_LAYOUTS,
  getTrackingSiteByCtv,
  upsertTrackingSite,
  type SiteInput,
  type TrackingSiteLayout,
} from "@/lib/ctv-portal";

const str = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};

export async function GET() {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  return NextResponse.json({ site: await getTrackingSiteByCtv(session.ctvId) });
}

export async function PUT(request: Request) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });

  const layout = TRACKING_LAYOUTS.some((l) => l.value === b.layout) ? (b.layout as TrackingSiteLayout) : "classic";
  const color = TRACKING_COLORS.some((c) => c.value === b.color) || b.color === "custom" ? String(b.color) : "ocean";
  const custom = typeof b.custom_color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.custom_color) ? b.custom_color : null;
  const input: SiteInput = {
    slug: String(b.slug ?? ""),
    display_name: (str(b.display_name, 80) ?? ""),
    layout,
    color,
    custom_color: custom,
    zalo: str(b.zalo, 255),
    whatsapp: str(b.whatsapp, 255),
    facebook: str(b.facebook, 255),
    email: str(b.email, 255),
    phone: str(b.phone, 50),
    address: str(b.address, 255),
    enabled: b.enabled !== false,
  };
  const r = await upsertTrackingSite(session.ctvId, input);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, site: await getTrackingSiteByCtv(session.ctvId) });
}
