// Kango trả mã tracking chặng cuối nhưng thường KHÔNG kèm hãng và đường dẫn tra cứu
// (last_mile rỗng, tracking_url null). Tự nhận hãng từ tên dịch vụ ("AIR-EU-DHL-PRIORITY",
// "...-UPS") rồi từ dạng mã, và dựng link tra cứu của hãng đó.

type CarrierDef = { name: string; url: (code: string) => string };

const CARRIERS: Record<string, CarrierDef> = {
  DHL: { name: "DHL", url: (c) => `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(c)}` },
  UPS: { name: "UPS", url: (c) => `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(c)}` },
  DPD: { name: "DPD", url: (c) => `https://tracking.dpd.de/status/en_US/parcel/${encodeURIComponent(c)}` },
  FEDEX: { name: "FedEx", url: (c) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(c)}` },
};

// Hãng không nhận ra được: dùng trang tra cứu đa hãng.
const FALLBACK: CarrierDef = {
  name: "",
  url: (c) => `https://t.17track.net/en#nums=${encodeURIComponent(c)}`,
};

function detectCarrierKey(code: string, hint: string): string | null {
  const text = hint.toUpperCase();
  if (/\bDHL\b/.test(text)) return "DHL";
  if (/\bUPS\b/.test(text)) return "UPS";
  if (/\bDPD\b/.test(text)) return "DPD";
  if (/\bFEDEX\b/.test(text)) return "FEDEX";

  const c = code.trim().toUpperCase();
  if (/^1Z[0-9A-Z]{16}$/.test(c)) return "UPS";
  if (/^[A-Z]{2}\d{9}DE$/.test(c)) return "DHL"; // mã S10 của Deutsche Post/DHL
  if (/^\d{10}$/.test(c)) return "DHL"; // DHL Express
  return null;
}

export function resolveLastMile(
  code: string,
  opts: { service?: string; carrier?: string; kangoUrl?: string | null }
): { carrier: string; url: string } {
  const kangoUrl = opts.kangoUrl && /^https?:\/\//i.test(opts.kangoUrl) ? opts.kangoUrl : null;
  const key = detectCarrierKey(code, `${opts.carrier ?? ""} ${opts.service ?? ""}`);
  const def = (key && CARRIERS[key]) || FALLBACK;
  return {
    carrier: opts.carrier?.trim() || def.name,
    url: kangoUrl ?? def.url(code),
  };
}
