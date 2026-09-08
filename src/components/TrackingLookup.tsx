"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  MapPinIcon,
  PhoneIcon,
  SearchIcon,
} from "@/components/icons";

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
};

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
};

type StepStage = "early" | "final" | "delivered";

/**
 * Mốc "DESTINATION CUSTOMS RELEASED" là ranh giới giữa 2 giai đoạn: từ lúc
 * nhận hàng tới khi thông quan ở nước đến (xanh dương), sau đó là chặng
 * giao cuối (vàng). "steps" xếp mới nhất trước (trackings[0] = mới nhất)
 * nên mốc này càng gần đầu mảng (index nhỏ) nghĩa là càng GẦN hiện tại —
 * mọi mốc từ vị trí đó trở LÊN đầu (index nhỏ hơn) đã ở giai đoạn "sau
 * thông quan".
 */
function findDestinationCustomsReleasedIndex(steps: TrackingStep[]): number {
  return steps.findIndex((s) => s.title.toLowerCase().includes("destination customs released"));
}

function isDeliveredStep(step: TrackingStep): boolean {
  return step.title.toLowerCase().includes("delivered");
}

function stageOf(step: TrackingStep, index: number, customsIndex: number): StepStage {
  if (isDeliveredStep(step)) return "delivered";
  if (customsIndex === -1) return "early"; // chưa thông quan nước đến -> vẫn ở giai đoạn đầu
  return index >= customsIndex ? "early" : "final";
}

/** Giai đoạn của trạng thái mới nhất — dùng để tô màu tag cạnh mã vận đơn. */
function currentStage(result: { currentStatus: string; steps: TrackingStep[] }): StepStage {
  if (result.steps.length === 0) {
    return result.currentStatus.toLowerCase().includes("delivered") ? "delivered" : "early";
  }
  const customsIndex = findDestinationCustomsReleasedIndex(result.steps);
  return stageOf(result.steps[0], 0, customsIndex);
}

const STAGE_STYLES: Record<StepStage, { dot: string; dotCurrent: string; text: string; badge: string }> = {
  early: {
    dot: "border-2 border-navy-300 bg-white text-navy-600",
    dotCurrent: "bg-navy-700 text-white",
    text: "text-navy-800",
    badge: "bg-navy-50 text-navy-700",
  },
  final: {
    dot: "border-2 border-amber-300 bg-white text-amber-600",
    dotCurrent: "bg-amber-500 text-white",
    text: "text-amber-700",
    badge: "bg-amber-50 text-amber-700",
  },
  delivered: {
    dot: "bg-emerald-500 text-white",
    dotCurrent: "bg-emerald-500 text-white",
    text: "text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700",
  },
};

export default function TrackingLookup() {
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function lookup(raw: string) {
    const code = raw.trim();
    if (!code) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/tracking?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Có lỗi xảy ra");
      setResult(json.found ? json.data : null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Không thể tra cứu lúc này"
      );
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
          className="w-full rounded-full border border-line bg-white px-5 py-3.5 text-sm text-ink placeholder:text-ink/35 focus:border-flame-400"
        />
        <button type="submit" disabled={status === "loading"} className="btn-primary shrink-0">
          <SearchIcon className="h-4 w-4" />
          {status === "loading" ? "Đang tra cứu..." : "Tra cứu"}
        </button>
      </form>

      {status === "loading" && (
        <p className="mx-auto mt-3 max-w-xl text-center text-xs text-ink/45">
          Đang lấy hành trình mới nhất từ đối tác vận chuyển — có thể mất vài giây với đơn tra lần đầu.
        </p>
      )}

      {status === "done" && (
        <div className="mx-auto mt-10 max-w-2xl">
          {errorMsg ? (
            <div className="card p-8 text-center">
              <p className="font-semibold text-navy-900">{errorMsg}</p>
            </div>
          ) : result ? (
            <div className="card p-6 sm:p-8">
              <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">
                    Mã vận đơn
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-navy-900">
                    {result.falcoCode}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${STAGE_STYLES[currentStage(result)].badge}`}
                >
                  {result.currentStatus}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-ink/45">Người nhận</p>
                  <p className="mt-1 font-medium text-navy-900">
                    {result.recipientName || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink/45">Dịch vụ</p>
                  <p className="mt-1 font-medium text-navy-900">
                    {result.service || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink/45">Điểm đến</p>
                  <p className="mt-1 font-medium text-navy-900">
                    {result.destination || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink/45">Số bill</p>
                  <p className="mt-1 font-medium text-navy-900">
                    {result.awb || "—"}
                  </p>
                </div>
              </div>

              {result.steps.length > 0 && (
                <ol className="mt-7 space-y-0">
                  {(() => {
                    const customsIndex = findDestinationCustomsReleasedIndex(result.steps);
                    return result.steps.map((step, i) => {
                      const isLast = i === result.steps.length - 1;
                      const isCurrent = i === 0;
                      const stage = stageOf(step, i, customsIndex);
                      const style = STAGE_STYLES[stage];
                      return (
                        <li key={i} className="relative flex gap-4 pb-7 last:pb-0">
                          {!isLast && (
                            <span
                              className="absolute left-[11px] top-6 h-full w-px bg-line"
                              aria-hidden
                            />
                          )}
                          <span
                            className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              isCurrent ? style.dotCurrent : style.dot
                            }`}
                          >
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                          </span>
                          <div>
                            <p className={`text-sm font-semibold ${style.text}`}>
                              {step.title}
                            </p>
                            <p className="mt-0.5 text-xs text-ink/50">
                              {step.time}
                              {step.location ? ` · ${step.location}` : ""}
                            </p>
                          </div>
                        </li>
                      );
                    });
                  })()}
                </ol>
              )}

              {result.parcels.length > 1 && (
                <div className="mt-7 border-t border-line pt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">
                    Chi tiết {result.parcels.length} kiện hàng
                  </p>
                  <div className="mt-3 space-y-2">
                    {result.parcels.map((p, i) => (
                      <div
                        key={p.trackingCode}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-mist px-4 py-2.5 text-sm"
                      >
                        <span className="font-medium text-navy-900">
                          Kiện {i + 1} · {p.trackingCode}
                        </span>
                        <span className="text-ink/60">{p.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(result.ksnPostUrl || result.lastMileWebsite || result.parcels.length > 0) && (
                <div className="mt-7 flex flex-wrap gap-3 border-t border-line pt-6">
                  {result.ksnPostUrl && (
                    <a
                      href={result.ksnPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                    >
                      Xem chi tiết hành trình vận chuyển
                      <ArrowRightIcon className="h-4 w-4" />
                    </a>
                  )}
                  {result.parcels
                    .filter((p) => p.trackingUrl)
                    .map((p, i) => (
                      <a
                        key={p.trackingCode}
                        href={p.trackingUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline"
                      >
                        {result.parcels.length > 1
                          ? `${result.lastMileCarrier || "Đối tác"} · Kiện ${i + 1}`
                          : `Tra cứu tại ${result.lastMileCarrier || "đối tác vận chuyển"}`}
                      </a>
                    ))}
                </div>
              )}

              {(result.lastMileCarrier || result.contactInformation) && (
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink/50">
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
          ) : (
            <div className="card p-8 text-center">
              <p className="font-semibold text-navy-900">
                Không tìm thấy vận đơn &ldquo;{value}&rdquo;
              </p>
              <p className="mt-2 text-sm text-ink/55">
                Vui lòng kiểm tra lại mã vận đơn, hoặc liên hệ hotline{" "}
                <span className="font-semibold text-navy-800">
                  0383 700 663
                </span>{" "}
                để được hỗ trợ.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
