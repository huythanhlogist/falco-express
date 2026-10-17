"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  LockIcon,
  MapPinIcon,
  PhoneIcon,
  SearchIcon,
} from "@/components/icons";
import { SITE } from "@/lib/constants";

type Status = "idle" | "loading" | "done";

type TrackingStep = {
  title: string;
  time: string;
  location: string | null;
};

type TrackingParcel = {
  hawb: string;
  trackingCode: string;
  status: string;
  trackingUrl: string | null;
  carrier: string;
};

type RouteEta = { fromDays: number; toDays: number; medianDays: number; sample: number };

type TrackingResult = {
  falcoCode: string;
  awb: string;
  recipientName: string;
  service: string;
  destination: string;
  currentStatus: string;
  steps: TrackingStep[];
  parcels: TrackingParcel[];
  lastMileCarrier: string;
  lastMileWebsite: string;
  contactInformation: string;
  ksnPostUrl: string;
  shipmentStatus: string;
  milestoneIndex: number;
  milestoneTimes: string[];
  receivedDate: string | null;
  recipientVerified: boolean;
  canVerifyRecipient: boolean;
  routeEta: RouteEta | null;
};

// Cùng thứ tự với TRACKING_MILESTONES trong src/lib/shipment-status.ts.
const MILESTONES = ["Đã nhận hàng", "Đã bay", "Đang thông quan", "Đã thông quan", "Đang giao", "Đã giao"];
const DELIVERED_INDEX = 5;
const CUSTOMS_INDEX = 2;
const STEPS_PREVIEW = 4;

/** "2026-10-12 14:33:00" | "12/10/2026 14:33" → Date (giờ địa phương). */
function parseTime(value: string | null): Date | null {
  if (!value) return null;
  let m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  m = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0));
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayMonth = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

type EtaView =
  | { kind: "delivered"; days: number }
  | { kind: "expected"; from: Date; to: Date; sample: number; late: boolean }
  | null;

function etaOf(r: TrackingResult, now = new Date()): EtaView {
  const received = parseTime(r.receivedDate);
  if (!received) return null;
  if (r.milestoneIndex === DELIVERED_INDEX) {
    const delivered = parseTime(r.milestoneTimes[DELIVERED_INDEX]);
    if (!delivered) return null;
    const days = daysBetween(received, delivered);
    return days >= 1 ? { kind: "delivered", days } : null;
  }
  if (r.milestoneIndex < 0 || !r.routeEta) return null;
  const from = addDays(received, r.routeEta.fromDays);
  const to = addDays(received, r.routeEta.toDays);
  return { kind: "expected", from, to, sample: r.routeEta.sample, late: now > addDays(to, 1) };
}

function ZaloButton({ label }: { label: string }) {
  return (
    <a href={SITE.zaloHref} target="_blank" rel="noopener noreferrer" className="btn-primary shrink-0">
      {label}
      <ArrowRightIcon className="h-4 w-4" />
    </a>
  );
}

function MilestoneTimeline({ result }: { result: TrackingResult }) {
  const current = result.milestoneIndex;
  return (
    <ol className="grid grid-cols-1 gap-0 sm:grid-cols-6" aria-label="Tiến trình đơn hàng">
      {MILESTONES.map((label, i) => {
        const done = current >= 0 && i <= current;
        const isCurrent = i === current;
        const time = parseTime(result.milestoneTimes[i] ?? "");
        const delivered = isCurrent && i === DELIVERED_INDEX;
        return (
          <li key={label} className="relative flex items-start gap-3 pb-5 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center">
            {/* đường nối: dọc trên mobile, ngang trên desktop */}
            {i < MILESTONES.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 sm:left-1/2 sm:top-[13px] sm:h-0.5 sm:w-full ${
                  current > i ? "bg-falco-accent" : "bg-falco-border"
                }`}
              />
            )}
            <span
              className={`keep-round relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                delivered
                  ? "bg-emerald-600 text-white"
                  : isCurrent
                    ? "bg-falco-accent text-white ring-4 ring-falco-accent/20"
                    : done
                      ? "bg-falco-navy text-white"
                      : "border-2 border-falco-border bg-white text-falco-muted"
              }`}
            >
              {done && !isCurrent ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 sm:px-1">
              <span className={`block text-sm font-semibold ${isCurrent ? "text-falco-accent" : done ? "text-falco-navy" : "text-falco-muted"} ${delivered ? "!text-emerald-700" : ""}`}>
                {label}
              </span>
              <span className="block text-xs text-falco-muted">{time ? dayMonth(time) : done ? "" : "—"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RecipientField({
  result,
  onVerified,
}: {
  result: TrackingResult;
  onVerified: (r: TrackingResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!postcode.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: result.falcoCode, postcode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không xác minh được");
      onVerified(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xác minh được");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col-span-2 sm:col-span-1">
      <p className="text-xs text-falco-muted">Người nhận</p>
      <p className="mt-1 flex items-center gap-1.5 font-medium text-falco-navy">
        {!result.recipientVerified && <LockIcon className="h-3.5 w-3.5 shrink-0 text-falco-muted" />}
        {result.recipientName || "—"}
      </p>
      {!result.recipientVerified && result.canVerifyRecipient && !open && (
        <button type="button" onClick={() => setOpen(true)} className="mt-1 text-xs font-semibold text-falco-accent hover:underline">
          Xem đầy đủ
        </button>
      )}
      {open && !result.recipientVerified && (
        <form onSubmit={verify} className="mt-2">
          <label htmlFor="recipient-postcode" className="block text-xs text-falco-muted">
            Nhập mã bưu chính (postcode) của người nhận
          </label>
          <div className="mt-1 flex gap-1.5">
            <input
              id="recipient-postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              autoComplete="off"
              placeholder="VD: 10115"
              className="h-9 w-24 min-w-0 flex-1 border border-falco-border bg-white px-2.5 text-sm text-falco-text focus:border-falco-navy"
            />
            <button type="submit" disabled={busy} className="h-9 shrink-0 bg-falco-navy px-3 text-xs font-bold text-white hover:bg-falco-navy-dark disabled:opacity-60">
              {busy ? "..." : "Xác minh"}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-falco-accent">{error}</p>}
        </form>
      )}
    </div>
  );
}

function ShareFalco({ result, deliveredDays }: { result: TrackingResult; deliveredDays: number | null }) {
  const [copied, setCopied] = useState(false);
  const url = "https://falcoexpress.com/?utm_source=tracking&utm_medium=referral&utm_campaign=delivered_share";
  const text = `Mình vừa gửi hàng đi ${result.destination || "nước ngoài"} qua Falco Express${
    deliveredDays ? `, người nhận có hàng sau ${deliveredDays} ngày` : ", hàng tới nơi đầy đủ"
  }. Ai cần gửi đồ cho người thân thì nhắn Falco nhé:`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Falco Express", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Người dùng huỷ chia sẻ — không cần báo lỗi.
    }
  }

  return (
    <button type="button" onClick={share} className="btn-outline shrink-0">
      {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
      {copied ? "Đã chép lời giới thiệu" : "Giới thiệu cho bạn bè"}
    </button>
  );
}

/** Khối hành động theo trạng thái — mỗi trạng thái 1 việc rõ ràng cho khách. */
function NextAction({ result, eta }: { result: TrackingResult; eta: EtaView }) {
  if (result.milestoneIndex === DELIVERED_INDEX) {
    return (
      <div className="flex flex-col gap-4 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-emerald-800">Hàng đã tới tay người nhận</p>
          <p className="mt-1 text-sm text-emerald-900/70">Cần gửi tiếp? Nhắn Falco để được báo giá trong vài phút.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ZaloButton label="Gửi đơn mới" />
          <ShareFalco result={result} deliveredDays={eta?.kind === "delivered" ? eta.days : null} />
        </div>
      </div>
    );
  }

  const late = eta?.kind === "expected" && eta.late;
  if (result.milestoneIndex < 0 || result.milestoneIndex === CUSTOMS_INDEX || late) {
    const title =
      result.milestoneIndex < 0
        ? "Đơn hàng đang được hoàn trả"
        : late
          ? "Đơn đang đi lâu hơn thường lệ"
          : "Đơn đang làm thủ tục thông quan";
    const body =
      result.milestoneIndex === CUSTOMS_INDEX && !late
        ? "Đây là bước bình thường. Nếu hải quan cần thêm giấy tờ, Falco sẽ chủ động liên hệ bạn."
        : "Falco sẽ kiểm tra trực tiếp với đối tác vận chuyển cho bạn.";
    return (
      <div className="flex flex-col gap-4 border-l-4 border-falco-accent bg-falco-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-falco-navy">{title}</p>
          <p className="mt-1 text-sm text-falco-muted">
            {body} Nhắn Falco qua Zalo kèm mã <span className="font-semibold text-falco-navy">{result.falcoCode}</span>.
          </p>
        </div>
        <ZaloButton label="Hỏi Falco qua Zalo" />
      </div>
    );
  }
  return null;
}

export default function TrackingLookup() {
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAllSteps, setShowAllSteps] = useState(false);

  async function lookup(raw: string) {
    const code = raw.trim();
    if (!code) return;

    setStatus("loading");
    setErrorMsg("");
    setShowAllSteps(false);

    try {
      const res = await fetch(`/api/tracking?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Có lỗi xảy ra");
      setResult(json.found ? json.data : null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể tra cứu lúc này");
      setResult(null);
    } finally {
      setStatus("done");
    }
  }

  useEffect(() => {
    const ma = searchParams.get("ma");
    if (ma) {
      setValue(ma);
      lookup(ma);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const eta = result ? etaOf(result) : null;
  const visibleSteps = result ? (showAllSteps ? result.steps : result.steps.slice(0, STEPS_PREVIEW)) : [];

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(value);
        }}
        className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="tracking-code" className="sr-only">
          Mã vận đơn
        </label>
        <input
          id="tracking-code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Nhập mã vận đơn, VD: FL250906001"
          className="w-full border border-falco-border bg-white px-5 py-3.5 text-sm text-falco-text placeholder:text-falco-muted/70 focus:border-falco-navy"
        />
        <button type="submit" disabled={status === "loading"} className="btn-primary shrink-0">
          <SearchIcon className="h-4 w-4" />
          {status === "loading" ? "Đang tra cứu..." : "Tra cứu"}
        </button>
      </form>

      {status === "loading" && (
        <p className="mx-auto mt-3 max-w-xl text-center text-xs text-falco-muted">
          Đang lấy hành trình mới nhất từ đối tác vận chuyển — có thể mất vài giây với đơn tra lần đầu.
        </p>
      )}

      {status === "done" && (
        <div className="mx-auto mt-10 max-w-3xl">
          {errorMsg ? (
            <div className="border border-falco-border bg-white p-8 text-center">
              <p className="font-semibold text-falco-navy">{errorMsg}</p>
            </div>
          ) : result ? (
            <div className="border border-falco-border bg-white">
              {/* Đầu thẻ: mã + trạng thái */}
              <div className="flex flex-col gap-3 border-b border-falco-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-falco-muted">Mã vận đơn</p>
                  <p className="mt-1 text-xl font-extrabold text-falco-navy">{result.falcoCode}</p>
                </div>
                <span
                  className={`inline-flex w-fit items-center px-3.5 py-1.5 text-sm font-bold ${
                    result.milestoneIndex === DELIVERED_INDEX
                      ? "bg-emerald-50 text-emerald-700"
                      : result.milestoneIndex < 0
                        ? "bg-rose-50 text-rose-700"
                        : "bg-falco-accent/10 text-falco-accent"
                  }`}
                >
                  {result.milestoneIndex < 0 ? "Hoàn trả" : MILESTONES[result.milestoneIndex]}
                </span>
              </div>

              {/* Timeline 6 mốc */}
              <div className="border-b border-falco-border p-5 sm:p-7">
                <MilestoneTimeline result={result} />
              </div>

              {/* Thời gian giao */}
              {eta && (
                <div className="flex items-start gap-3 border-b border-falco-border bg-falco-surface px-5 py-4 sm:px-7">
                  <ClockIcon className="mt-0.5 h-5 w-5 shrink-0 text-falco-navy" />
                  {eta.kind === "delivered" ? (
                    <p className="text-sm text-falco-text">
                      Đã giao sau <span className="font-bold text-falco-navy">{eta.days} ngày</span> kể từ khi Falco nhận hàng.
                    </p>
                  ) : (
                    <p className="text-sm text-falco-text">
                      Dự kiến giao:{" "}
                      <span className="font-bold text-falco-navy">
                        {dayMonth(eta.from)} – {dayMonth(eta.to)}
                      </span>
                      <span className="block text-xs text-falco-muted">
                        Ước tính từ {eta.sample} đơn Falco đã giao gần đây cùng tuyến — không phải cam kết.
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div className="p-5 sm:p-7">
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <RecipientField result={result} onVerified={setResult} />
                  <div>
                    <p className="text-xs text-falco-muted">Dịch vụ</p>
                    <p className="mt-1 font-medium text-falco-navy">{result.service || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-falco-muted">Điểm đến</p>
                    <p className="mt-1 font-medium text-falco-navy">{result.destination || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-falco-muted">Số bill</p>
                    <p className="mt-1 font-medium text-falco-navy">{result.awb || "—"}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <NextAction result={result} eta={eta} />
                </div>

                {result.steps.length > 0 && (
                  <div className="mt-7">
                    <p className="text-xs font-semibold uppercase tracking-wider text-falco-muted">Chi tiết hành trình</p>
                    <ol className="mt-4">
                      {visibleSteps.map((step, i) => {
                        const isLast = i === visibleSteps.length - 1;
                        const isCurrent = i === 0;
                        return (
                          <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                            {!isLast && <span className="absolute left-[11px] top-6 h-full w-px bg-falco-border" aria-hidden />}
                            <span
                              className={`keep-round z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                                isCurrent ? "bg-falco-navy text-white" : "border-2 border-falco-border bg-white text-falco-muted"
                              }`}
                            >
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <p className={`text-sm font-semibold ${isCurrent ? "text-falco-navy" : "text-falco-text"}`}>{step.title}</p>
                              <p className="mt-0.5 text-xs text-falco-muted">
                                {step.time}
                                {step.location ? ` · ${step.location}` : ""}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    {result.steps.length > STEPS_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setShowAllSteps((v) => !v)}
                        className="mt-4 text-sm font-semibold text-falco-accent hover:underline"
                      >
                        {showAllSteps ? "Thu gọn" : `Xem toàn bộ ${result.steps.length} cập nhật`}
                      </button>
                    )}
                  </div>
                )}

                {result.parcels.length > 0 && (
                  <div className="mt-7 border-t border-falco-border pt-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-falco-muted">
                      Mã vận đơn chặng cuối
                      {result.parcels.length > 1 ? ` (${result.parcels.length} kiện)` : ""}
                    </p>
                    <div className="mt-3 space-y-2">
                      {result.parcels.map((p, i) => (
                        <div key={p.trackingCode} className="flex flex-wrap items-center justify-between gap-3 bg-falco-surface px-4 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="break-all font-semibold text-falco-navy">
                              {result.parcels.length > 1 ? `Kiện ${i + 1} · ` : ""}
                              {p.trackingCode}
                            </p>
                            <p className="mt-0.5 text-xs text-falco-muted">
                              {p.status}
                              {p.carrier ? ` · ${p.carrier}` : ""}
                            </p>
                          </div>
                          {p.trackingUrl && (
                            <a href={p.trackingUrl} target="_blank" rel="noopener noreferrer" className="btn-outline shrink-0">
                              {p.carrier ? `Tra cứu tại ${p.carrier}` : "Tra cứu chặng cuối"}
                              <ArrowRightIcon className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(result.lastMileCarrier || result.contactInformation) && (
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-falco-muted">
                    {result.lastMileCarrier && (
                      <span className="flex items-center gap-1.5">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        Đối tác giao hàng chặng cuối: {result.lastMileCarrier}
                      </span>
                    )}
                    {result.contactInformation && (
                      <span className="flex items-center gap-1.5">
                        <PhoneIcon className="h-3.5 w-3.5" />
                        {result.contactInformation}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-falco-border bg-white p-8 text-center">
              <p className="font-semibold text-falco-navy">Không tìm thấy vận đơn &ldquo;{value}&rdquo;</p>
              <p className="mt-2 text-sm text-falco-muted">
                Vui lòng kiểm tra lại mã vận đơn, hoặc liên hệ hotline{" "}
                <a href={SITE.hotlineHref} className="font-semibold text-falco-navy">
                  {SITE.hotline}
                </a>{" "}
                để được hỗ trợ.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
