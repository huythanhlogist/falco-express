"use client";

import OrderTrackingButton from "@/components/admin/OrderTrackingButton";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import OrderRowActions from "@/components/admin/OrderRowActions";
import CopyOrderInfoButton from "@/components/admin/CopyOrderInfoButton";
import CtvOrderReviewActions from "@/components/admin/CtvOrderReviewActions";
import { useConfirm, useToast } from "@/components/ui/Toast";
import { CopyIcon, CheckIcon } from "@/components/icons";
import type { OrderListItem } from "@/lib/db";
import { shipmentStatusClassName, shipmentStatusLabel } from "@/lib/shipment-status";
import { loadDraft, saveDraft, clearDraft } from "@/lib/session-draft";
import { ORDERS_SELECTION_KEY, QUOTE_HANDOFF_KEY, type QuoteHandoffOrder } from "@/lib/quote-handoff";
import { formatDateVN } from "@/lib/vn-date";

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

function pickOrder(o: OrderListItem): QuoteHandoffOrder {
  return {
    id: o.id,
    falco_code: o.falco_code,
    recipient_name: o.recipient_name,
    destination: o.destination,
    weight_kg: o.weight_kg,
    received_date: o.received_date,
  };
}

type CtvOption = { id: number; ctv_code: string; full_name: string };

export default function OrdersTable({ orders, ctvs = [] }: { orders: OrderListItem[]; ctvs?: CtvOption[] }) {
  const router = useRouter();
  const ask = useConfirm();
  const toast = useToast();
  // Giữ cả thông tin đơn đã chọn (không chỉ id) để lựa chọn sống qua phân
  // trang/đổi bộ lọc — các link đó tải lại trang nên state thường bị mất.
  const [selected, setSelected] = useState<Map<number, QuoteHandoffOrder>>(new Map());
  const [selectionRestored, setSelectionRestored] = useState(false);
  const [copiedBulk, setCopiedBulk] = useState(false);
  const [assignCtv, setAssignCtv] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  async function assign(ctvId: number | null) {
    if (selected.size === 0) return;
    if (
      ctvId === null &&
      !(await ask(`Bỏ gán FWD khỏi ${selected.size} đơn đã chọn?`, { confirmLabel: "Bỏ gán" }))
    ) {
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/orders/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: [...selected.keys()], ctvId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Lỗi gán FWD");
      toast(ctvId ? `Đã gán ${j.changed} đơn cho FWD` : `Đã bỏ gán ${j.changed} đơn`);
      setSelected(new Map());
      setAssignCtv("");
      startRefresh(() => router.refresh());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Không kết nối được tới máy chủ", "error");
    } finally {
      setAssigning(false);
    }
  }

  function handleOrderDeleted(deletedId: number) {
    setSelected((prev) => {
      if (!prev.has(deletedId)) return prev;
      const next = new Map(prev);
      next.delete(deletedId);
      return next;
    });
  }

  useEffect(() => {
    const saved = loadDraft<QuoteHandoffOrder[]>(ORDERS_SELECTION_KEY);
    if (saved?.length) setSelected(new Map(saved.map((o) => [o.id, o])));
    setSelectionRestored(true);
  }, []);

  useEffect(() => {
    if (!selectionRestored) return;
    if (selected.size === 0) clearDraft(ORDERS_SELECTION_KEY);
    else saveDraft(ORDERS_SELECTION_KEY, [...selected.values()]);
  }, [selected, selectionRestored]);

  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));

  function toggleOne(order: OrderListItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(order.id)) next.delete(order.id);
      else next.set(order.id, pickOrder(order));
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allSelected) orders.forEach((o) => next.delete(o.id));
      else orders.forEach((o) => next.set(o.id, pickOrder(o)));
      return next;
    });
  }

  function createQuote() {
    if (selected.size === 0) return;
    saveDraft(QUOTE_HANDOFF_KEY, [...selected.values()]);
    clearDraft(ORDERS_SELECTION_KEY);
    router.push("/admin/dbn");
  }

  async function copySelected() {
    const codes = [...selected.values()].map((o) => o.falco_code);
    if (codes.length === 0) return;
    await copyText(codes.join("\n"));
    setCopiedBulk(true);
    setTimeout(() => setCopiedBulk(false), 1500);
  }

  return (
    <div className="mt-3">
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-100 bg-white/95 px-4 py-2.5 shadow-md backdrop-blur">
          <p className="text-sm font-medium text-navy-800">
            Đã chọn {selected.size} đơn
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Map())}
              className="text-xs font-medium text-ink/50 hover:text-ink/80"
            >
              Bỏ chọn
            </button>
            {ctvs.length > 0 && (
              <span className="flex items-center gap-1.5">
                <select
                  value={assignCtv}
                  onChange={(e) => setAssignCtv(e.target.value)}
                  aria-label="Chọn FWD để gán"
                  className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">Chọn FWD…</option>
                  {ctvs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ctv_code} · {c.full_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!assignCtv || assigning}
                  onClick={() => assign(Number(assignCtv))}
                  className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Gán FWD
                </button>
                <button
                  type="button"
                  disabled={assigning}
                  onClick={() => assign(null)}
                  className="text-xs font-medium text-ink/50 hover:text-ink/80"
                >
                  Bỏ gán
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={createQuote}
              className="inline-flex items-center gap-1.5 rounded-lg bg-flame-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-flame-700"
            >
              Tạo DBN ({selected.size})
            </button>
            <button
              type="button"
              onClick={copySelected}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                copiedBulk
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-navy-800 text-white hover:bg-navy-900"
              }`}
            >
              {copiedBulk ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5" /> Đã copy
                </>
              ) : (
                <>
                  <CopyIcon className="h-3.5 w-3.5" /> Copy mã đã chọn
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className={`max-h-[calc(100vh-16rem)] min-h-[320px] overflow-auto rounded-xl border border-line bg-white shadow-sm transition-opacity duration-150 ${refreshing ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-line bg-mist text-left text-[11px] font-semibold uppercase tracking-wide text-ink/50 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Chọn tất cả"
                  className="h-4 w-4 rounded border-line accent-navy-800"
                />
              </th>
              <th className="px-3 py-2">Đơn / AWB</th>
              <th className="px-3 py-2">Người nhận</th>
              <th className="px-3 py-2">Điểm đến</th>
              <th className="px-3 py-2">Dịch vụ</th>
              <th className="px-3 py-2">Ngày nhận</th>
              <th className="px-3 py-2">Vận chuyển</th>
              <th className="px-3 py-2">Nguồn</th>
              <th className="px-3 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const copyTextValue = `${o.falco_code} - ${o.recipient_name ?? ""} - ${o.tracking_codes ?? ""}`;
              return (
                <tr
                  key={o.id}
                  className={`border-b border-line last:border-0 hover:bg-mist/40 ${
                    selected.has(o.id) ? "bg-navy-50/60" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleOne(o)}
                      aria-label={`Chọn đơn ${o.falco_code}`}
                      className="h-4 w-4 rounded border-line accent-navy-800"
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <OrderTrackingButton falcoCode={o.falco_code} />
                    {o.awb && o.awb !== o.falco_code && <span className="block text-xs text-ink/50">{o.awb}</span>}
                  </td>
                  <td className="max-w-[190px] px-3 py-2">
                    <span className="block truncate text-ink/85" title={o.recipient_name ?? ""}>{o.recipient_name || "—"}</span>
                    {o.recipient_phone && <span className="block truncate text-xs text-ink/50">{o.recipient_phone}</span>}
                  </td>
                  <td className="max-w-[170px] px-3 py-2">
                    <span className="block truncate text-ink/75" title={o.destination ?? ""}>{o.destination || "—"}</span>
                    {o.recipient_postcode && <span className="block text-xs text-ink/50">{o.recipient_postcode}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {o.service ? (
                      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-mist px-2.5 py-1 text-xs font-bold text-navy-800">
                        {o.service}
                      </span>
                    ) : (
                      <span className="text-ink/30">—</span>
                    )}
                    <span className="mt-0.5 block text-xs text-ink/50">{o.parcel_count} kiện</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink/70">
                    {formatDateVN(o.received_date) || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {o.shipment_status ? (
                      <span
                        title={`${o.shipment_current ?? ""}${
                          o.shipment_fetched_at
                            ? `\nCập nhật: ${new Date(o.shipment_fetched_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
                            : ""
                        }`}
                        className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${shipmentStatusClassName(o.shipment_status)}`}
                      >
                        {shipmentStatusLabel(o.shipment_status)}
                      </span>
                    ) : (
                      <span className="text-ink/30">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <CtvOrderReviewActions orderId={o.id} reviewStatus={o.review_status} ctvCode={o.ctv_code} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <OrderRowActions orderId={o.id} falcoCode={o.falco_code} onDeleted={handleOrderDeleted} />
                      <CopyOrderInfoButton text={copyTextValue} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-ink/45">
                  Không tìm thấy đơn hàng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
