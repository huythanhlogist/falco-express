"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { BAY_SERVICE_CLASSES, BAY_SERVICE_LABELS, BAY_STATUS_LABELS } from "@/lib/bay-labels";
import type { BayShipment, BayTracking } from "@/lib/bay-api";

type ApiError = { error?: string; code?: string; requestId?: string | null };

const BAY_IMG_ORIGIN = "https://img.bayonlinevn.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chỉ proxy ảnh thuộc origin https://img.bayonlinevn.com/<uuid> qua /api/admin/bay/img/<uuid>,
// tránh làm gãy ảnh từ domain ngoài tình cờ có UUID ở cuối URL.
function proxiedImageUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (parsed.origin !== BAY_IMG_ORIGIN) return raw;
    const id = parsed.pathname.replace(/^\/+|\/+$/g, "");
    return UUID_RE.test(id) ? `/api/admin/bay/img/${id.toLowerCase()}` : raw;
  } catch {
    return raw;
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function PhotoGrid({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((u) => {
        const src = proxiedImageUrl(u);
        return (
          <a
            key={u}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            title="Mở ảnh gốc"
            className="group block overflow-hidden rounded-xl border border-[#ecece8] bg-[#fafaf8]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Ảnh vận đơn"
              loading="lazy"
              className="h-20 w-20 object-cover transition-transform duration-150 group-hover:scale-105"
            />
          </a>
        );
      })}
    </div>
  );
}

export default function BayTrackingDrawer({
  reference,
  febCode,
  shipment,
  onClose,
}: {
  reference: string | null;
  febCode?: string;
  shipment?: BayShipment | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<BayTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [entered, setEntered] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // Hiệu ứng trượt từ phải vào khi ngăn kéo mở.
  useEffect(() => {
    if (!reference) {
      setEntered(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, [reference]);

  // Khoá cuộn nền và cho phép bấm Esc để đóng ngăn kéo.
  useEffect(() => {
    if (!reference) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [reference, onClose]);

  useEffect(() => {
    if (!reference) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setData(null);
    setError("");
    setLoading(true);
    fetch(`/api/admin/bay/shipments/${encodeURIComponent(reference)}/tracking`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as (BayTracking & ApiError) | null;
        if (!res.ok) {
          const baseMsg = json?.error ?? `Lỗi HTTP ${res.status}`;
          throw new Error(json?.requestId ? `${baseMsg} (requestId ${json.requestId})` : baseMsg);
        }
        return json as BayTracking;
      })
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message || "Không tải được hành trình vận đơn");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reference, reloadTick]);

  const handleDownloadPdf = useCallback(async () => {
    if (!reference || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/admin/bay/pdf?ref=${encodeURIComponent(reference)}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as ApiError | null;
        throw new Error(j?.error ?? `Không tạo được PDF (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const baseName = (febCode || reference).replace(/[^A-Za-z0-9._-]/g, "_");
      a.href = url;
      a.download = `${baseName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Đã tải file PDF hành trình", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Tải PDF thất bại", "error");
    } finally {
      setDownloadingPdf(false);
    }
  }, [reference, febCode, downloadingPdf, toast]);

  if (!reference || typeof document === "undefined") return null;

  const statusCode = data?.shipmentStatus ?? shipment?.status ?? "";
  const statusLabel = statusCode ? (BAY_STATUS_LABELS[statusCode] ?? statusCode) : "";
  const carrierCode = data?.carrier.code ?? shipment?.carrier.code ?? null;
  const trackingNumber = data?.carrier.trackingNumber ?? shipment?.carrier.trackingNumber ?? null;
  const trackingUrl = data?.carrier.trackingUrl ?? shipment?.carrier.trackingUrl ?? null;
  const destination = shipment
    ? [shipment.recipient.address.city, shipment.recipient.address.countryCode].filter(Boolean).join(", ")
    : "";

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] flex justify-end bg-[#132440]/40 backdrop-blur-[1px] transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Hành trình vận đơn ${reference}`}
        className={`flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Đầu ngăn kéo cố định */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ecece8] px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-base font-bold text-[#132440]">
                {febCode ? febCode : `Hành trình ${reference}`}
              </h2>
              {febCode && (
                <span className="rounded-full bg-[#f5f5f3] px-2 py-0.5 text-[11px] font-semibold text-[#52525b] tabular-nums">
                  {reference}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-[#6b7280]">
              {statusLabel || "Đang tải trạng thái…"}
              {trackingNumber && ` · ${carrierCode?.toUpperCase() ?? "Hãng"} ${trackingNumber}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data && (
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={downloadingPdf}
                className="rounded-xl border border-[#e7e7e3] bg-white px-3 py-1.5 text-xs font-semibold text-[#132440] transition-colors hover:bg-[#f5f5f3] disabled:opacity-50"
                title="Tải file PDF hành trình kèm ảnh hàng về máy"
              >
                {downloadingPdf ? "Đang tạo PDF…" : "Tải PDF"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng ngăn kéo hành trình"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#6b7280] transition-colors hover:bg-[#f5f5f3] hover:text-[#132440]"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Nội dung cuộn riêng bên trong ngăn kéo */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Tóm tắt nhanh thông tin vận đơn */}
          {shipment && (
            <div className="mb-4 rounded-2xl border border-[#ecece8] bg-[#fafaf8] p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#14181f]">
                  {shipment.recipient.name || "Chưa có tên người nhận"}
                </span>
                <span
                  className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    BAY_SERVICE_CLASSES[shipment.serviceType] ?? "bg-[#ebebea] text-[#4b5563]"
                  }`}
                >
                  {BAY_SERVICE_LABELS[shipment.serviceType] ?? shipment.serviceType}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[#52525b]">
                <div className="truncate">
                  <span className="text-[#8b8d93]">Điểm đến: </span>
                  <span className="font-medium text-[#14181f]">{destination || "—"}</span>
                </div>
                <div className="tabular-nums">
                  <span className="text-[#8b8d93]">Cân nặng: </span>
                  <span className="font-medium text-[#14181f]">
                    {shipment.parcel.weightKg.total != null ? `${shipment.parcel.weightKg.total} kg` : "—"}
                  </span>
                </div>
                {shipment.partnerReference && (
                  <div className="col-span-2 truncate">
                    <span className="text-[#8b8d93]">Mã tham chiếu: </span>
                    <span className="font-medium text-[#14181f]">{shipment.partnerReference}</span>
                  </div>
                )}
                {trackingNumber && (
                  <div className="col-span-2 flex items-center gap-1.5 truncate">
                    <span className="text-[#8b8d93]">Hãng vận chuyển: </span>
                    {trackingUrl ? (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-semibold text-[#132440] underline underline-offset-2 hover:text-[#f7941d]"
                      >
                        {carrierCode?.toUpperCase() ?? "Hãng"} {trackingNumber}
                      </a>
                    ) : (
                      <span className="truncate font-medium text-[#14181f]">
                        {carrierCode?.toUpperCase() ?? "Hãng"} {trackingNumber}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-3 py-2" aria-live="polite">
              <p className="text-sm text-[#6b7280]">Đang tải hành trình vận đơn…</p>
              <div className="space-y-2.5">
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="rounded-xl border border-[#ecece8] p-3">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-[#ecece8]" />
                    <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[#f4f4f1]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setReloadTick((n) => n + 1)}
                className="mt-2.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Thử tải lại
              </button>
            </div>
          )}

          {data && (
            <div className="space-y-5">
              {data.receiveItems.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#8b8d93]">
                    Kiện đã nhận tại kho ({data.receiveItems.length})
                  </h3>
                  <ul className="mt-2 space-y-2.5">
                    {data.receiveItems.map((r) => (
                      <li
                        key={r.code}
                        className="rounded-2xl border border-[#ecece8] bg-[#fafaf8] p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-semibold text-[#132440]">
                            {r.code} <span className="font-normal text-[#6b7280]">× {r.quantity}</span>
                          </span>
                          <span className="text-xs text-[#8b8d93] tabular-nums">
                            {formatDateTime(r.receivedAt)}
                          </span>
                        </div>
                        <PhotoGrid urls={r.images} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#8b8d93]">
                    Chi tiết hành trình
                  </h3>
                  {data.lastUpdatedAt && (
                    <span className="text-[11px] text-[#8b8d93] tabular-nums">
                      Cập nhật {formatDateTime(data.lastUpdatedAt)}
                    </span>
                  )}
                </div>

                {data.events.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-dashed border-[#ecece8] px-4 py-6 text-center text-sm text-[#8b8d93]">
                    Chưa có mốc hành trình nào.
                  </p>
                ) : (
                  <ol className="mt-3 space-y-4 border-l-2 border-[#ecece8] pl-4">
                    {data.events.map((e, i) => (
                      <li key={`${e.occurredAt}-${e.code}-${i}`} className="relative">
                        <span
                          className={`absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                            e.source === "bay" ? "bg-[#132440]" : "bg-[#16a34a]"
                          }`}
                        />
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="text-sm font-semibold text-[#132440]">
                            {e.description ?? e.code}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                              e.source === "bay"
                                ? "bg-[#eef2f7] text-[#132440]"
                                : "bg-[#e8f6ee] text-[#15803d]"
                            }`}
                          >
                            {e.source === "bay" ? "BayOnline" : "Hãng vận chuyển"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[#6b7280] tabular-nums">
                          {formatDateTime(e.occurredAt)}
                          {e.location && ` · ${e.location}${e.countryCode ? `, ${e.countryCode}` : ""}`}
                          {e.notes && ` · ${e.notes}`}
                          {e.packageCode && ` · kiện ${e.packageCode}`}
                        </p>
                        <PhotoGrid urls={e.images} />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
