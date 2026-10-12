"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThuStatusSelect from "@/components/admin/ThuStatusSelect";
import OrderRowActions from "@/components/admin/OrderRowActions";
import CopyOrderInfoButton from "@/components/admin/CopyOrderInfoButton";
import CtvOrderReviewActions from "@/components/admin/CtvOrderReviewActions";
import { CopyIcon, CheckIcon } from "@/components/icons";
import type { OrderListItem } from "@/lib/db";
import { shipmentStatusClassName, shipmentStatusLabel } from "@/lib/shipment-status";
import { loadDraft, saveDraft, clearDraft } from "@/lib/session-draft";
import { ORDERS_SELECTION_KEY, QUOTE_HANDOFF_KEY, type QuoteHandoffOrder } from "@/lib/quote-handoff";

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
  };
}

export default function OrdersTable({ orders }: { orders: OrderListItem[] }) {
  const router = useRouter();
  // Giữ cả thông tin đơn đã chọn (không chỉ id) để lựa chọn sống qua phân
  // trang/đổi bộ lọc — các link đó tải lại trang nên state thường bị mất.
  const [selected, setSelected] = useState<Map<number, QuoteHandoffOrder>>(new Map());
  const [selectionRestored, setSelectionRestored] = useState(false);
  const [copiedBulk, setCopiedBulk] = useState(false);

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
    router.push("/admin/ke-toan#bao-gia");
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
        <div className="mb-2 flex items-center justify-between rounded-xl border border-line bg-mist/60 px-4 py-2.5">
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
            <button
              type="button"
              onClick={createQuote}
              className="inline-flex items-center gap-1.5 rounded-lg bg-flame-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-flame-700"
            >
              Tạo báo giá ({selected.size})
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

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[1400px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Chọn tất cả"
                  className="h-4 w-4 rounded border-line accent-navy-800"
                />
              </th>
              <th className="px-3 py-2">Mã Falco</th>
              <th className="px-3 py-2">AWB</th>
              <th className="px-3 py-2">Người nhận</th>
              <th className="px-3 py-2">Điện thoại</th>
              <th className="px-3 py-2">Điểm đến</th>
              <th className="px-3 py-2">Kiện</th>
              <th className="px-3 py-2">Ngày nhận</th>
              <th className="px-3 py-2">Vận chuyển</th>
              <th className="px-3 py-2">Nguồn</th>
              <th className="px-3 py-2">Trạng thái thu</th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Gửi khách</th>
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
                  <td className="px-3 py-2 font-semibold text-navy-900">{o.falco_code}</td>
                  <td className="px-3 py-2 text-ink/70">{o.awb}</td>
                  <td className="px-3 py-2 text-ink/70">{o.recipient_name || "—"}</td>
                  <td className="px-3 py-2 text-ink/70">{o.recipient_phone || "—"}</td>
                  <td className="px-3 py-2 text-ink/70">{o.destination || "—"}</td>
                  <td className="px-3 py-2 text-ink/70">{o.parcel_count}</td>
                  <td className="px-3 py-2 text-ink/70">
                    {o.received_date
                      ? new Date(o.received_date).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
                      : "—"}
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
                    <ThuStatusSelect orderId={o.id} initialStatus={o.payment_status} />
                  </td>
                  <td className="px-3 py-2">
                    <OrderRowActions orderId={o.id} falcoCode={o.falco_code} />
                  </td>
                  <td className="px-3 py-2">
                    <CopyOrderInfoButton text={copyTextValue} />
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={13} className="px-5 py-10 text-center text-ink/45">
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
