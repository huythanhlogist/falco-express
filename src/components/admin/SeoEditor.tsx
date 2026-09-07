"use client";

import { useState, useTransition } from "react";

type Page = { path: string; label: string };

type SeoValue = { metaTitle: string; metaDescription: string };

export default function SeoEditor({
  pages,
  initialValues,
}: {
  pages: Page[];
  initialValues: Record<string, SeoValue>;
}) {
  const [values, setValues] = useState<Record<string, SeoValue>>(initialValues);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(path: string, field: keyof SeoValue, value: string) {
    setValues((prev) => ({
      ...prev,
      [path]: { ...prev[path], [field]: value },
    }));
  }

  function save(path: string) {
    const value = values[path];
    startTransition(async () => {
      const res = await fetch("/api/admin/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePath: path,
          metaTitle: value.metaTitle,
          metaDescription: value.metaDescription,
        }),
      });
      if (res.ok) {
        setSavedPath(path);
        setTimeout(() => setSavedPath((p) => (p === path ? null : p)), 2000);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {pages.map((page) => {
        const value = values[page.path] || { metaTitle: "", metaDescription: "" };
        return (
          <div key={page.path} className="rounded-2xl border border-line bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-sm font-bold text-navy-900">{page.label}</p>
                <p className="text-xs text-ink/45">{page.path}</p>
              </div>
              {savedPath === page.path && (
                <span className="text-xs font-semibold text-emerald-600">Đã lưu</span>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-ink/60">Tiêu đề (title)</label>
                <input
                  type="text"
                  value={value.metaTitle}
                  onChange={(e) => update(page.path, "metaTitle", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-flame-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink/60">Mô tả (description)</label>
                <textarea
                  value={value.metaDescription}
                  onChange={(e) => update(page.path, "metaDescription", e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-flame-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => save(page.path)}
              disabled={isPending}
              className="btn-primary mt-4 disabled:opacity-50"
            >
              Lưu
            </button>
          </div>
        );
      })}
    </div>
  );
}
