"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Kind = "success" | "error" | "info";
type Item = { id: number; kind: Kind; text: string };
type ToastApi = (text: string, kind?: Kind) => void;

const ToastContext = createContext<ToastApi>(() => {});
export const useToast = () => useContext(ToastContext);

/** Thông báo nổi ở góc dưới: báo thành công/lỗi sau mỗi thao tác thay cho alert() và dòng chữ nhỏ dễ bỏ sót. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);
  const push = useCallback<ToastApi>((text, kind = "success") => {
    const id = next.current++;
    setItems((cur) => [...cur.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  const color: Record<Kind, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-flame-200 bg-flame-50 text-flame-800",
    info: "border-line bg-white text-navy-900",
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-[min(92vw,360px)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast-in pointer-events-auto rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${color[t.kind]}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
