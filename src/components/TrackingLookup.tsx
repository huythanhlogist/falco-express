"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEMO_CODES, DEMO_TRACKING, type TrackingResult } from "@/lib/tracking-demo";
import { CheckCircleIcon, ClockIcon, SearchIcon } from "@/components/icons";

export default function TrackingLookup() {
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);

  function lookup(raw: string) {
    const code = raw.trim().toUpperCase();
    setSubmitted(true);
    setResult(DEMO_TRACKING[code] ?? null);
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
          placeholder="Nhập mã vận đơn, VD: FL123456789VN"
          className="w-full rounded-full border border-line bg-white px-5 py-3.5 text-sm text-ink placeholder:text-ink/35 focus:border-flame-400"
        />
        <button type="submit" className="btn-primary shrink-0">
          <SearchIcon className="h-4 w-4" />
          Tra cứu
        </button>
      </form>

      <p className="mx-auto mt-3 max-w-xl text-center text-xs text-ink/45">
        Đây là trang minh hoạ chức năng tra cứu. Thử các mã demo:{" "}
        {DEMO_CODES.map((c, i) => (
          <span key={c}>
            <button
              type="button"
              onClick={() => {
                setValue(c);
                lookup(c);
              }}
              className="font-semibold text-navy-700 underline decoration-dotted underline-offset-2 hover:text-flame-600"
            >
              {c}
            </button>
            {i < DEMO_CODES.length - 1 ? ", " : "."}
          </span>
        ))}
      </p>

      {submitted && (
        <div className="mx-auto mt-10 max-w-2xl">
          {result ? (
            <div className="card p-6 sm:p-8">
              <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">
                    Mã vận đơn
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-navy-900">
                    {result.code}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-flame-50 px-4 py-1.5 text-sm font-bold text-flame-700">
                  {result.status}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-ink/45">Dịch vụ</p>
                  <p className="mt-1 font-medium text-navy-900">{result.service}</p>
                </div>
                <div>
                  <p className="text-xs text-ink/45">Từ</p>
                  <p className="mt-1 font-medium text-navy-900">{result.from}</p>
                </div>
                <div>
                  <p className="text-xs text-ink/45">Đến</p>
                  <p className="mt-1 font-medium text-navy-900">{result.to}</p>
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
                        {step.time && (
                          <p className="mt-0.5 text-xs text-ink/50">
                            {step.time} · {step.location}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <p className="font-semibold text-navy-900">
                Không tìm thấy vận đơn &ldquo;{value}&rdquo;
              </p>
              <p className="mt-2 text-sm text-ink/55">
                Đây là bản demo minh hoạ giao diện tra cứu. Hệ thống tra cứu
                thực tế sẽ được kết nối với dữ liệu vận đơn chính thức của
                Falco Express.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
