"use client";

import { useState } from "react";
import ThuStatusSelect from "@/components/admin/ThuStatusSelect";
import OrderRowActions from "@/components/admin/OrderRowActions";
import CopyOrderInfoButton from "@/components/admin/CopyOrderInfoButton";
import CtvOrderReviewActions from "@/components/admin/CtvOrderReviewActions";
import { CopyIcon, CheckIcon } from "@/components/icons";
import type { OrderListItem } from "@/lib/db";

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

export default function OrdersTable({ orders }: { orders: OrderListItem[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copiedBulk, setCopiedBulk] = useState(false);

  const allSelected = orders.length > 0 && selected.size === orders.length;

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)));
  }

  async function copySelected() {
    const codes = orders.filter((o) => selected.has(o.id)).map((o) => o.falco_code);
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
              onClick={() => setSelected(new Set())}
              className="text-xs font-medium text-ink/50 hover:text-ink/80"
            >
              Bỏ chọn
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
        <table className="w-full min-w-[1280px] text-sm">
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
                      onChange={() => toggleOne(o.id)}
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
                <td colSpan={12} className="px-5 py-10 text-center text-ink/45">
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
