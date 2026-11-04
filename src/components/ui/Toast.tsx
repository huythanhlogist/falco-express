"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";

type Kind = "success" | "error" | "info";
type Item = { id: number; kind: Kind; text: string };
type ToastApi = (text: string, kind?: Kind) => void;

const ToastContext = createContext<ToastApi>(() => {});
export const useToast = () => useContext(ToastContext);

type AskFn = (message: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
const ConfirmContext = createContext<AskFn>(async (m) => (typeof window !== "undefined" ? window.confirm(m) : false));
/** Hộp xác nhận đẹp thay cho confirm() của trình duyệt: `if (!(await ask("Xoá đơn này?"))) return;` */
export const useConfirm = () => useContext(ConfirmContext);

/** Thông báo nổi ở góc dưới: báo thành công/lỗi sau mỗi thao tác thay cho alert() và dòng chữ nhỏ dễ bỏ sót. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);
  const push = useCallback<ToastApi>((text, kind = "success") => {
    const id = next.current++;
    setItems((cur) => [...cur.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  const [ask, setAsk] = useState<{ message: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void } | null>(null);
  const confirmFn = useCallback<AskFn>(
    (message, opts) => new Promise<boolean>((resolve) => setAsk({ message, confirmLabel: opts?.confirmLabel ?? "Đồng ý", danger: opts?.danger ?? true, resolve })),
    []
  );
  const answer = (v: boolean) => {
    ask?.resolve(v);
    setAsk(null);
  };

  const color: Record<Kind, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-flame-200 bg-flame-50 text-flame-800",
    info: "border-line bg-white text-navy-900",
  };
  return (
    <ToastContext.Provider value={push}>
      <ConfirmContext.Provider value={confirmFn}>
      {children}
      <Modal
        open={!!ask}
        onClose={() => answer(false)}
        title="Xác nhận"
        footer={
          <>
            <button type="button" onClick={() => answer(false)} className="btn-outline !px-4 !py-2 text-sm">
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => answer(true)}
              className={`rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors ${ask?.danger ? "bg-flame-600 hover:bg-flame-700" : "bg-navy-800 hover:bg-navy-900"}`}
            >
              {ask?.confirmLabel}
            </button>
          </>
        }
      >
        <p className="whitespace-pre-line text-sm text-ink/80">{ask?.message}</p>
      </Modal>
      <div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-[min(92vw,360px)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast-in pointer-events-auto rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${color[t.kind]}`}>
            {t.text}
          </div>
        ))}
      </div>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}
