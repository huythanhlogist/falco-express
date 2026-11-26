"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import TrackingLookup from "@/components/TrackingLookup";

/** Bấm mã đơn → mở cửa sổ hành trình tracking của đơn đó (không chuyển trang). */
export default function OrderTrackingButton({
  falcoCode,
  className,
  children,
}: {
  falcoCode: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Xem tracking ${falcoCode}`}
        className={className ?? "font-semibold text-navy-900 underline-offset-2 hover:text-[#2563eb] hover:underline"}
      >
        {children ?? falcoCode}
      </button>
      {open && (
        <Modal open={open} onClose={() => setOpen(false)} title={`Tracking ${falcoCode}`} size="lg">
          <TrackingLookup initialCode={falcoCode} compact />
        </Modal>
      )}
    </>
  );
}
