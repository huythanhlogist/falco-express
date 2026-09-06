"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicOrder } from "@/lib/sheets";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  SearchIcon,
} from "@/components/icons";

type Status = "idle" | "loading" | "done";

function carrierTrackingUrl(carrier: string, code: string) {
  const c = carrier.trim().toLowerCase();
  if (c === "dhl") {
    return `https://www.dhl.com/vn-vi/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(code)}`;
  }
  if (c === "ups") {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(code)}`;
  }
  return "";
}

export default function TrackingLookup() {
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<PublicOrder | null>(null);
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
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-flame-50 px-4 py-1.5 text-sm font-bold text-flame-700">
                  {result.currentStatus}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
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
                    {result.billNumber || "—"}
                  </p>
                </div>
              </div>

              <ol className="mt-7 space-y-0">
                {result.steps.map((step, i) => {
                  const isLast = i === result.steps.length - 1;
                  return (
                    <li key={i} className="relative flex gap-4 pb-7 last:pb-0">
                      {!isLast && (
                        <span
                          className={`absolute left-[11px] top-6 h-full w-px ${
                            step.done ? "bg-flame-400" : "bg-line"
                          }`}
                          aria-hidden
                        />
                      )}
                      <span
                        className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          step.done
                            ? "bg-flame-500 text-white"
                            : "border-2 border-line bg-white text-ink/30"
                        }`}
                      >
                        {step.done ? (
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                        ) : (
                          <ClockIcon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            step.done ? "text-navy-900" : "text-ink/40"
                          }`}
                        >
                          {step.title}
                        </p>
                        {step.date && (
                          <p className="mt-0.5 text-xs text-ink/50">{step.date}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {(result.ksnPostUrl || result.lastMileCodes.length > 0) && (
                <div className="mt-7 flex flex-wrap gap-3 border-t border-line pt-6">
                  {result.ksnPostUrl && (
                    <a
                      href={result.ksnPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                    >
                      Xem tiến trình hải quan tại KSN Post
                      <ArrowRightIcon className="h-4 w-4" />
                    </a>
                  )}
                  {result.lastMileCodes.map((code, i) => {
                    const url = carrierTrackingUrl(result.lastMileCarrier, code);
                    const label =
                      result.lastMileCodes.length > 1
                        ? `Kiện ${i + 1} · ${result.lastMileCarrier} ${code}`
                        : `${result.lastMileCarrier} ${code}`;
                    return url ? (
                      <a key={code} href={url} target="_blank" rel="noopener noreferrer" className="btn-outline">
                        {label}
                      </a>
                    ) : (
                      <span
                        key={code}
                        className="btn-outline pointer-events-none"
                      >
                        {label}
                      </span>
                    );
                  })}
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
