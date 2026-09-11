"use client";

import { useRef, useState } from "react";
import { PencilIcon, TrashIcon } from "@/components/icons";
import type { CtvContentKind } from "@/lib/db";

type ContentItem = { id: number; title: string; content: string };

export default function CtvContentManager({
  kind,
  initialItems,
  titlePlaceholder,
  contentPlaceholder,
}: {
  kind: CtvContentKind;
  initialItems: ContentItem[];
  titlePlaceholder: string;
  contentPlaceholder: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ctv/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title: newTitle.trim(), content: newContent.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setItems((prev) => [...prev, { id: json.id, title: newTitle.trim(), content: newContent.trim() }]);
        setNewTitle("");
        setNewContent("");
        formRef.current?.reset();
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: ContentItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/ctv/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, title: editTitle, content: editContent } : i)));
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: number) {
    if (!confirm("Xoá mục này?")) return;
    const res = await fetch(`/api/admin/ctv/content/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      <form ref={formRef} onSubmit={addItem} className="flex flex-col gap-2.5 rounded-xl border border-line bg-white p-3.5">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={titlePlaceholder}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
        />
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={2}
          placeholder={contentPlaceholder}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
        />
        <button type="submit" disabled={saving} className="btn-primary self-start !px-4 !py-2 text-sm disabled:opacity-50">
          Thêm
        </button>
      </form>

      <div className="mt-3 flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-start gap-2 rounded-xl border border-line bg-white p-3">
            <span className="mt-1 shrink-0 text-xs font-bold text-ink/40">{i + 1}.</span>
            {editingId === item.id ? (
              <div className="flex-1">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm font-semibold"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm"
                />
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(item.id)}
                    disabled={saving}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Lưu
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs font-semibold text-ink/50 hover:underline">
                    Huỷ
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1">
                <p className="text-sm font-bold text-navy-900">{item.title}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-ink/70">{item.content}</p>
              </div>
            )}
            {editingId !== item.id && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-mist hover:text-navy-800"
                  title="Sửa"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-flame-50 hover:text-flame-700"
                  title="Xoá"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="p-4 text-center text-sm text-ink/45">Chưa có mục nào.</p>}
      </div>
    </div>
  );
}
