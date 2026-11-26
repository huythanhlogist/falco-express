"use client";

import { useState } from "react";
import { useConfirm, useToast } from "@/components/ui/Toast";
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
  const ask = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState(initialItems);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [savingEditId, setSavingEditId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    const content = newContent.trim();
    if (!title || !content) {
      toast("Vui lòng nhập đủ tiêu đề và nội dung", "error");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/ctv/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, content }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!res.ok || typeof json.id !== "number") {
        toast(json.error || "Không thêm được mục mới", "error");
        return;
      }
      setItems((prev) => [...prev, { id: json.id!, title, content }]);
      setNewTitle("");
      setNewContent("");
      toast("Đã thêm mục mới", "success");
    } catch {
      toast("Không kết nối được máy chủ", "error");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(item: ContentItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  }

  async function saveEdit(id: number) {
    const title = editTitle.trim();
    const content = editContent.trim();
    if (!title || !content) {
      toast("Vui lòng nhập đủ tiêu đề và nội dung", "error");
      return;
    }
    setSavingEditId(id);
    try {
      const res = await fetch(`/api/admin/ctv/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(json.error || "Không lưu được thay đổi", "error");
        return;
      }
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, title, content } : i)));
      setEditingId(null);
      toast("Đã lưu thay đổi", "success");
    } catch {
      toast("Không kết nối được máy chủ", "error");
    } finally {
      setSavingEditId(null);
    }
  }

  async function deleteItem(item: ContentItem) {
    if (
      !(await ask(`Xoá mục "${item.title}"? Thao tác này không thể hoàn tác.`, {
        confirmLabel: "Xoá",
        danger: true,
      }))
    ) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/admin/ctv/content/${item.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(json.error || "Không xoá được mục này", "error");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (editingId === item.id) setEditingId(null);
      toast("Đã xoá mục", "success");
    } catch {
      toast("Không kết nối được máy chủ", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <form
        onSubmit={addItem}
        className="flex flex-col gap-2.5 rounded-[20px] border border-[#ecece8] bg-white p-4 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]"
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={titlePlaceholder}
          className="w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
        />
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={2}
          placeholder={contentPlaceholder}
          className="w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
        />
        <button
          type="submit"
          disabled={adding}
          className="btn-primary self-start !px-4 !py-2 text-sm disabled:opacity-50"
        >
          {adding ? "Đang lưu…" : "Thêm"}
        </button>
      </form>

      <div className="mt-3 flex flex-col gap-2.5">
        {items.map((item, i) => {
          const isSavingEdit = savingEditId === item.id;
          const isDeleting = deletingId === item.id;
          return (
            <div
              key={item.id}
              className="flex items-start gap-2.5 rounded-[20px] border border-[#ecece8] bg-white p-4 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]"
            >
              <span className="mt-1 shrink-0 text-xs font-bold text-[#8b8d93] tabular-nums">{i + 1}.</span>
              {editingId === item.id ? (
                <div className="flex-1">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    disabled={isSavingEdit}
                    className="w-full rounded-xl border border-[#e7e7e3] bg-white px-3 py-1.5 text-sm font-semibold text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20 disabled:opacity-60"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={2}
                    disabled={isSavingEdit}
                    className="mt-2 w-full rounded-xl border border-[#e7e7e3] bg-white px-3 py-1.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20 disabled:opacity-60"
                  />
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => saveEdit(item.id)}
                      disabled={isSavingEdit}
                      className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                    >
                      {isSavingEdit ? "Đang lưu…" : "Lưu"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={isSavingEdit}
                      className="text-xs font-semibold text-ink/50 hover:underline disabled:opacity-50"
                    >
                      Huỷ
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#132440]">{item.title}</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-ink/70">{item.content}</p>
                </div>
              )}
              {editingId !== item.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    disabled={isDeleting}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/50 hover:bg-mist hover:text-[#132440] disabled:opacity-40"
                    title="Sửa"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(item)}
                    disabled={isDeleting}
                    className="flex h-7 items-center justify-center rounded-lg px-1.5 text-ink/50 hover:bg-flame-50 hover:text-flame-700 disabled:opacity-50"
                    title="Xoá"
                  >
                    {isDeleting ? (
                      <span className="text-xs font-semibold text-flame-700">Đang xoá…</span>
                    ) : (
                      <TrashIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-[20px] border border-[#ecece8] bg-white p-6 text-center text-sm text-[#8b8d93]">
            Chưa có mục nào.
          </div>
        )}
      </div>
    </div>
  );
}
