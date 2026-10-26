// Tên miền trung tính dành cho trang tra cứu thương hiệu riêng của FWD: <slug>.<TRACKING_BASE_DOMAIN>.
// Không chứa tên Falco/đối tác. Đặt biến TRACKING_BASE_DOMAIN (vd trackingsite.io.vn) để bật chế độ subdomain.
export function trackingBaseDomain(): string {
  return (process.env.TRACKING_BASE_DOMAIN || "").trim().toLowerCase();
}

/** Trả slug nếu host là "<slug>.<baseDomain>"; "" nếu là chính tên miền gốc; null nếu không thuộc tên miền tracking. */
export function slugFromHost(host: string | null | undefined, base = trackingBaseDomain()): string | null {
  if (!base || !host) return null;
  const h = host.toLowerCase().replace(/:\d+$/, "");
  if (h === base || h === `www.${base}`) return "";
  if (!h.endsWith(`.${base}`)) return null;
  const sub = h.slice(0, -(base.length + 1));
  return /^[a-z0-9-]{1,63}$/.test(sub) ? sub : "";
}
