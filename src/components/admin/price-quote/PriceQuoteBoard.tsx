"use client";

import { useState } from "react";
import { PencilIcon, TrashIcon } from "@/components/icons";
import PriceQuoteCard from "./PriceQuoteCard";
import PriceQuoteLineEditModal from "./PriceQuoteLineEditModal";
import PriceQuoteCategoryEditModal from "./PriceQuoteCategoryEditModal";
import type { PriceQuoteCategory, PriceQuoteLine } from "./types";

export default function PriceQuoteBoard({ initialCategories }: { initialCategories: PriceQuoteCategory[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [editingCategory, setEditingCategory] = useState<PriceQuoteCategory | null>(null);
  const [editingLine, setEditingLine] = useState<{ categoryId: number; line: PriceQuoteLine } | null>(null);

  async function deleteCategory(id: number) {
    if (!confirm("Xoá toàn bộ nhóm giá này (kể cả các dòng bên trong)?")) return;
    const res = await fetch(`/api/admin/price-quote/categories/${id}`, { method: "DELETE" });
    if (res.ok) setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  async function deleteLine(categoryId: number, lineId: number) {
    if (!confirm("Xoá dòng giá này?")) return;
    const res = await fetch(`/api/admin/price-quote/lines/${lineId}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, lines: c.lines.filter((l) => l.id !== lineId) } : c))
      );
    }
  }

  if (categories.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-ink/50">
        Chưa có bảng giá nào — vào tab &quot;Upload tài liệu&quot; để tải file Excel bảng giá Kango lên.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {categories.map((category) => (
        <div key={category.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-navy-900">{category.title}</h2>
              {category.note && <p className="mt-0.5 text-sm text-ink/55">{category.note}</p>}
              {category.uploadedAt && (
                <p className="mt-0.5 text-xs text-ink/40">
                  Cập nhật từ file {category.sourceFileName} lúc{" "}
                  {new Date(category.uploadedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditingCategory(category)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-mist hover:text-navy-800"
                title="Sửa nhóm"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => deleteCategory(category.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-flame-50 hover:text-flame-700"
                title="Xoá nhóm"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className={`mt-3 grid grid-cols-1 gap-4 ${category.lines.length > 1 ? "xl:grid-cols-2" : ""}`}>
            {category.lines.map((line) => (
              <PriceQuoteCard
                key={line.id}
                line={line}
                onEdit={() => setEditingLine({ categoryId: category.id, line })}
                onDelete={() => deleteLine(category.id, line.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {editingCategory && (
        <PriceQuoteCategoryEditModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSaved={(updated) => {
            setCategories((prev) =>
              prev.map((c) => (c.id === editingCategory.id ? { ...c, ...updated } : c))
            );
          }}
        />
      )}

      {editingLine && (
        <PriceQuoteLineEditModal
          line={editingLine.line}
          onClose={() => setEditingLine(null)}
          onSaved={(updated) => {
            setCategories((prev) =>
              prev.map((c) =>
                c.id === editingLine.categoryId
                  ? { ...c, lines: c.lines.map((l) => (l.id === editingLine.line.id ? { ...l, ...updated } : l)) }
                  : c
              )
            );
          }}
        />
      )}
    </div>
  );
}
