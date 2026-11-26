"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CloseIcon, CopyIcon, SearchIcon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/ui/Toast";
import { parseKangoHawbsJson } from "@/lib/kango-bill-validate";
import { formatDateVN } from "@/lib/vn-date";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "draft" | "sending" | "sent";

export type BillRow = {
  id: number;
  receiver_contact_name: string;
  receiver_telephone?: string | null;
  receiver_country: string;
  receiver_city?: string | null;
  shipment_service: string;
  shipment_reference_code?: string | null;
  status: "draft" | "sending" | "sent";
  kango_bill_id: string | null;
  kango_hawbs_json?: string | null;
  send_error?: string | null;
  created_by?: string | null;
  created_at?: string | Date | null;
};

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "draft", label: "Nháp" },
  { value: "sending", label: "Đang gửi" },
  { value: "sent", label: "Đã gửi" },
];

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function formatCreatedAt(raw: string | Date | null | undefined): { date: string; time: string } {
  if (!raw) return { date: "", time: "" };
  const date = formatDateVN(raw);
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return { date, time: "" };
  }
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return { date: date || String(raw), time: "" };
  const time = d.toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date, time };
}

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

export default function KangoBillsTable({ initialBills }: { initialBills: BillRow[] }) {
  const ask = useConfirm();
  const toast = useToast();
  const [bills, setBills] = useState<BillRow[]>(initialBills);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    setBills(initialBills);
  }, [initialBills]);

  const hasCreatedAt = useMemo(
    () => bills.length === 0 || bills.some((b) => Boolean(b.created_at)),
    [bills]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: bills.length, draft: 0, sending: 0, sent: 0 };
    for (const b of bills) {
      if (b.status === "draft") counts.draft += 1;
      else if (b.status === "sending") counts.sending += 1;
      else if (b.status === "sent") counts.sent += 1;
    }
    return counts;
  }, [bills]);

  const filteredBills = useMemo(() => {
    const q = normalizeSearch(search);
    return bills.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      const hawbs = parseKangoHawbsJson(b.kango_hawbs_json).join(" ");
      const haystack = normalizeSearch(
        [
          `#${b.id}`,
          String(b.id),
          b.receiver_contact_name,
          b.receiver_telephone ?? "",
          b.receiver_country,
          b.receiver_city ?? "",
          b.shipment_service,
          b.shipment_reference_code ?? "",
          b.kango_bill_id ?? "",
          hawbs,
        ].join(" ")
      );
      return haystack.includes(q);
    });
  }, [bills, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedBills = useMemo(
    () => filteredBills.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredBills, pageStart]
  );

  const rangeStart = filteredBills.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, filteredBills.length);
  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";
  const columnCount = hasCreatedAt ? 6 : 5;

  async function handleCopyCode(billId: number, code: string) {
    await copyText(code);
    setCopiedId(billId);
    toast(`Đã sao chép mã ${code}`, "info");
    setTimeout(() => {
      setCopiedId((cur) => (cur === billId ? null : cur));
    }, 1500);
  }

  async function removeBill(id: number) {
    if (
      !(await ask(`Xoá bill #${id}?\nThao tác này không thể hoàn tác.`, {
        confirmLabel: "Xoá bill",
        danger: true,
      }))
    ) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/kango-bills/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast(json?.error || `Xoá bill thất bại (HTTP ${res.status})`, "error");
        return;
      }
      setBills((prev) => prev.filter((b) => b.id !== id));
      toast(`Đã xoá bill #${id}`, "success");
    } catch {
      toast("Xoá bill thất bại — kiểm tra lại kết nối mạng", "error");
    } finally {
      setDeletingId(null);
    }
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  }

  return (
    <div className="rounded-[22px] border border-[#ecece8] bg-white shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]">
      {/* Thanh tìm kiếm & lọc trạng thái */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ecece8] px-4 py-3.5 sm:px-5">
        <div className="relative w-full sm:w-80">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8d93]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm mã bill, người nhận, SĐT, AWB/ID Kango…"
            aria-label="Tìm bill Kango"
            className="admin-input w-full !pl-9 !pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              aria-label="Xoá từ khoá tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[#8b8d93] hover:text-[#14181f]"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Lọc trạng thái bill"
            className="inline-flex items-center gap-0.5 rounded-xl bg-[#ebebea] p-[3px]"
          >
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.value;
              const count = statusCounts[tab.value];
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setStatusFilter(tab.value);
                    setPage(1);
                  }}
                  className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-xs transition-colors ${
                    active
                      ? "bg-[#132440] font-semibold text-white"
                      : "font-medium text-[#52525b] hover:text-[#14181f]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums ${
                      active ? "bg-white/20 text-white" : "bg-white/80 text-[#52525b]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bảng gọn 2 dòng/ô, không cuộn ngang ở màn 1280px */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#ecece8] bg-[#fafaf8] text-left">
              <th className="px-4 py-2.5">Mã bill / Kango ID</th>
              <th className="px-3 py-2.5">Người nhận</th>
              <th className="px-3 py-2.5">Dịch vụ / Điểm đến</th>
              {hasCreatedAt && <th className="px-3 py-2.5">Ngày tạo</th>}
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-4 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedBills.map((b) => {
              const hawbs = parseKangoHawbsJson(b.kango_hawbs_json);
              const subCode = b.kango_bill_id || b.shipment_reference_code || hawbs[0] || "";
              const subCodeLabel = b.kango_bill_id
                ? b.kango_bill_id
                : b.shipment_reference_code
                  ? `Ref: ${b.shipment_reference_code}`
                  : hawbs[0]
                    ? `HAWB: ${hawbs[0]}`
                    : "";
              const destinationLine = [b.receiver_city, b.receiver_country].filter(Boolean).join(", ");
              const created = formatCreatedAt(b.created_at);
              const isDeleting = deletingId === b.id;

              return (
                <tr key={b.id} className="border-b border-[#ecece8] last:border-0">
                  <td className="max-w-[190px] px-4 py-2.5 align-middle">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/admin/kango-bills/${b.id}`}
                        className="font-semibold text-[#132440] hover:text-[#f7941d] hover:underline"
                      >
                        #{b.id}
                      </Link>
                      {subCode && (
                        <button
                          type="button"
                          onClick={() => handleCopyCode(b.id, subCode)}
                          title={`Sao chép ${subCode}`}
                          aria-label={`Sao chép mã ${subCode}`}
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#8b8d93] hover:bg-[#f5f5f3] hover:text-[#132440]"
                        >
                          {copiedId === b.id ? (
                            <CheckIcon className="h-3.5 w-3.5 text-[#16a34a]" />
                          ) : (
                            <CopyIcon className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    {subCodeLabel ? (
                      <span
                        className="mt-0.5 block truncate text-xs text-[#8b8d93]"
                        title={hawbs.length > 0 ? `${subCodeLabel} · HAWB: ${hawbs.join(", ")}` : subCodeLabel}
                      >
                        {subCodeLabel}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-xs text-[#8b8d93]/60">Chưa có mã Kango</span>
                    )}
                  </td>

                  <td className="max-w-[220px] px-3 py-2.5 align-middle">
                    <span
                      className="block truncate font-semibold text-[#14181f]"
                      title={b.receiver_contact_name}
                    >
                      {b.receiver_contact_name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[#8b8d93]">
                      {b.receiver_telephone || "—"}
                    </span>
                  </td>

                  <td className="max-w-[180px] px-3 py-2.5 align-middle">
                    <span className="inline-flex max-w-full items-center truncate rounded-full bg-[#f5f5f3] px-2.5 py-0.5 text-xs font-semibold text-[#132440]">
                      {b.shipment_service}
                    </span>
                    <span
                      className="mt-0.5 block truncate text-xs text-[#8b8d93]"
                      title={destinationLine}
                    >
                      {destinationLine || "—"}
                    </span>
                  </td>

                  {hasCreatedAt && (
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                      <span className="block text-[13px] text-[#14181f]">{created.date || "—"}</span>
                      {created.time && (
                        <span
                          className="mt-0.5 block text-xs text-[#8b8d93]"
                          title={b.created_by ? `Tạo bởi: ${b.created_by}` : undefined}
                        >
                          {created.time}
                        </span>
                      )}
                    </td>
                  )}

                  <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        b.status === "sent"
                          ? "bg-[#e8f6ee] text-[#16a34a]"
                          : b.status === "sending"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-[#f5f5f3] text-[#52525b]"
                      }`}
                    >
                      {b.status === "sent" ? "Đã gửi" : b.status === "sending" ? "Đang gửi" : "Nháp"}
                    </span>
                    {b.send_error && b.status !== "sent" && (
                      <span
                        className="mt-0.5 block max-w-[140px] truncate text-[11px] font-medium text-flame-700"
                        title={b.send_error}
                      >
                        Lỗi gửi: {b.send_error}
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-2.5 text-right align-middle">
                    <div className="inline-flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/kango-bills/${b.id}`}
                        className="text-xs font-semibold text-[#132440] hover:text-[#f7941d] hover:underline"
                      >
                        {b.status === "draft" ? "Xem/Sửa" : "Xem"}
                      </Link>
                      {b.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => removeBill(b.id)}
                          disabled={deletingId !== null}
                          className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
                        >
                          {isDeleting ? "Đang xoá…" : "Xoá"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {bills.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-12 text-center">
                  <p className="text-sm font-medium text-[#52525b]">Chưa có bill Kango nào.</p>
                  <p className="mt-1 text-xs text-[#8b8d93]">
                    Bấm &quot;Tạo bill mới&quot; ở góc trên để tạo phiếu gửi hàng nháp đầu tiên.
                  </p>
                </td>
              </tr>
            )}

            {bills.length > 0 && filteredBills.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-[#52525b]">
                    Không tìm thấy bill phù hợp với bộ lọc hiện tại.
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-2.5 inline-flex items-center rounded-lg border border-[#ecece8] bg-white px-3 py-1.5 text-xs font-semibold text-[#132440] hover:bg-[#f5f5f3]"
                    >
                      Xoá bộ lọc
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Chân bảng: tóm tắt số lượng & phân trang phía client (20 dòng/trang) */}
      {bills.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ecece8] px-4 py-3 text-xs text-[#8b8d93] sm:px-5">
          <p className="tabular-nums">
            Hiển thị <span className="font-semibold text-[#14181f]">{rangeStart}</span>–
            <span className="font-semibold text-[#14181f]">{rangeEnd}</span> /{" "}
            <span className="font-semibold text-[#14181f]">{filteredBills.length}</span> bill
            {filteredBills.length !== bills.length && ` (lọc từ ${bills.length} bill)`}
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-[#ecece8] bg-white px-3 py-1.5 text-xs font-semibold text-[#132440] hover:bg-[#f5f5f3] disabled:opacity-40"
              >
                Trước
              </button>
              <span className="px-2 text-xs font-medium text-[#52525b] tabular-nums">
                Trang {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-[#ecece8] bg-white px-3 py-1.5 text-xs font-semibold text-[#132440] hover:bg-[#f5f5f3] disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
