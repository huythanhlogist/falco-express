"use client";

import { useState } from "react";
import PriceQuoteBoard from "./PriceQuoteBoard";
import PolicyManager from "./PolicyManager";
import type { PriceQuoteCategory, PolicyItem } from "./types";

export default function PriceQuoteTabs({
  categories,
  policyItems,
}: {
  categories: PriceQuoteCategory[];
  policyItems: PolicyItem[];
}) {
  const [tab, setTab] = useState<"bang-gia" | "chinh-sach">("bang-gia");

  return (
    <div>
      <div className="flex gap-2">
        {[
          { key: "bang-gia" as const, label: "Bảng giá" },
          { key: "chinh-sach" as const, label: "Chính sách" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-navy-800 text-white" : "bg-mist text-ink/60 hover:bg-line"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "bang-gia" ? (
          <PriceQuoteBoard initialCategories={categories} />
        ) : (
          <PolicyManager initialItems={policyItems} />
        )}
      </div>
    </div>
  );
}
