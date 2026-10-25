// Hằng số/kiểu dùng chung cho Tracking Site — KHÔNG import code server (db) để component client dùng được.
export type TrackingSiteLayout = "classic" | "split" | "bold" | "card" | "minimal";
export const TRACKING_LAYOUTS: { value: TrackingSiteLayout; label: string }[] = [
  { value: "classic", label: "Cổ điển" },
  { value: "split", label: "Cột đôi" },
  { value: "bold", label: "Thanh đậm" },
  { value: "card", label: "Thẻ nổi" },
  { value: "minimal", label: "Tối giản" },
];

export const TRACKING_COLORS: { value: string; label: string; hex: string }[] = [
  { value: "ocean", label: "Ocean", hex: "#0e7490" },
  { value: "navy", label: "Navy", hex: "#1e3a8a" },
  { value: "forest", label: "Forest", hex: "#15803d" },
  { value: "rose", label: "Rose", hex: "#e11d48" },
  { value: "slate", label: "Slate", hex: "#475569" },
  { value: "ember", label: "Ember", hex: "#c2410c" },
  { value: "indigo", label: "Indigo", hex: "#4338ca" },
  { value: "gold", label: "Gold", hex: "#a16207" },
  { value: "ink", label: "Ink", hex: "#18181b" },
  { value: "sunset", label: "Sunset", hex: "#f97316" },
];

