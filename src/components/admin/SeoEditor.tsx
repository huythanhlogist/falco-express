"use client";

import { useMemo, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";

type Page = { path: string; label: string };

type SeoValue = { metaTitle: string; metaDescription: string };

type PageGroup = "all" | "main" | "country" | "blog";

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

function getPageGroup(path: string): Exclude<PageGroup, "all"> {
  if (path.startsWith("/gui-hang-di-")) return "country";
  if (path === "/blog" || path.startsWith("/blog/")) return "blog";
  return "main";
}

export default function SeoEditor({
  pages,
  initialValues,
}: {
  pages: Page[];
  initialValues: Record<string, SeoValue>;
}) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, SeoValue>>(initialValues);
  const [savedValues, setSavedValues] = useState<Record<string, SeoValue>>(initialValues);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<PageGroup>("all");
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [savingPaths, setSavingPaths] = useState<Record<string, boolean>>({});

  const groupCounts = useMemo(() => {
    const counts: Record<PageGroup, number> = { all: pages.length, main: 0, country: 0, blog: 0 };
    for (const p of pages) {
      counts[getPageGroup(p.path)] += 1;
    }
    return counts;
  }, [pages]);

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter((page) => {
      if (group !== "all" && getPageGroup(page.path) !== group) return false;
      if (!q) return true;
      const val = values[page.path];
      return `${page.label} ${page.path} ${val?.metaTitle ?? ""} ${val?.metaDescription ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [pages, group, query, values]);

  function update(path: string, field: keyof SeoValue, value: string) {
    setValues((prev) => {
      const current = prev[path] ?? { metaTitle: "", metaDescription: "" };
      return {
        ...prev,
        [path]: { ...current, [field]: value },
      };
    });
  }

  async function save(page: Page) {
    const value = values[page.path] ?? { metaTitle: "", metaDescription: "" };
    setSavingPaths((prev) => ({ ...prev, [page.path]: true }));
    try {
      const res = await fetch("/api/admin/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pagePath: page.path,
          metaTitle: value.metaTitle,
          metaDescription: value.metaDescription,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(json.error || `Không lưu được SEO cho "${page.label}"`, "error");
        return;
      }
      setSavedValues((prev) => ({
        ...prev,
        [page.path]: { metaTitle: value.metaTitle, metaDescription: value.metaDescription },
      }));
      setSavedPath(page.path);
      setTimeout(() => setSavedPath((p) => (p === page.path ? null : p)), 2500);
      toast(`Đã lưu SEO cho "${page.label}"`, "success");
    } catch {
      toast("Không kết nối được máy chủ", "error");
    } finally {
      setSavingPaths((prev) => {
        const next = { ...prev };
        delete next[page.path];
        return next;
      });
    }
  }

  const hasFilter = Boolean(query.trim()) || group !== "all";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-[22px] border border-[#ecece8] bg-white p-4 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8d93]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Lọc theo tên trang, đường dẫn hoặc nội dung SEO..."
            aria-label="Lọc trang SEO"
            className="w-full rounded-xl border border-[#e7e7e3] bg-[#fafaf8] py-2 pl-9 pr-8 text-sm text-[#14181f] placeholder:text-[#8b8d93] focus:border-[#132440] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#132440]/10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Xoá từ khoá lọc trang"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#8b8d93] hover:bg-[#ecece8] hover:text-[#14181f]"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center gap-0.5 rounded-xl bg-[#ebebea] p-[3px]">
            {(
              [
                { value: "all", label: "Tất cả" },
                { value: "main", label: "Trang chính" },
                { value: "country", label: "Tuyến quốc gia" },
                { value: "blog", label: "Blog" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setGroup(tab.value)}
                className={`rounded-[9px] px-2.5 py-1 text-xs font-semibold transition-colors ${
                  group === tab.value
                    ? "bg-[#132440] text-white"
                    : "text-[#52525b] hover:text-[#14181f]"
                }`}
              >
                {tab.label} ({groupCounts[tab.value]})
              </button>
            ))}
          </div>
          <span className="text-xs font-medium text-[#8b8d93] tabular-nums">
            Hiển thị {filteredPages.length}/{pages.length} trang
          </span>
        </div>
      </div>

      {pages.length === 0 && (
        <div className="rounded-[22px] border border-[#ecece8] bg-white p-8 text-center text-sm text-[#8b8d93]">
          Chưa có trang nào để cấu hình SEO.
        </div>
      )}

      {pages.length > 0 && filteredPages.length === 0 && (
        <div className="rounded-[22px] border border-[#ecece8] bg-white p-8 text-center text-sm text-[#8b8d93]">
          <p>Không tìm thấy trang phù hợp với bộ lọc.</p>
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setGroup("all");
              }}
              className="mt-2 text-xs font-semibold text-[#132440] hover:underline"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>
      )}

      {filteredPages.map((page) => {
        const value = values[page.path] || { metaTitle: "", metaDescription: "" };
        const saved = savedValues[page.path] || { metaTitle: "", metaDescription: "" };
        const isDirty =
          value.metaTitle !== saved.metaTitle || value.metaDescription !== saved.metaDescription;
        const isSaving = Boolean(savingPaths[page.path]);
        const titleLen = value.metaTitle.length;
        const descLen = value.metaDescription.length;
        const titleOver = titleLen > TITLE_LIMIT;
        const descOver = descLen > DESCRIPTION_LIMIT;

        return (
          <div
            key={page.path}
            className="rounded-[22px] border border-[#ecece8] bg-white p-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-sm font-bold text-[#132440]">{page.label}</p>
                <p className="text-xs text-[#8b8d93]">{page.path}</p>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="rounded-full bg-[#f7941d]/15 px-2.5 py-0.5 text-xs font-semibold text-[#c26a08]">
                    Chưa lưu
                  </span>
                )}
                {savedPath === page.path && !isDirty && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    Đã lưu
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3.5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-ink/60">Tiêu đề (title)</label>
                  <span
                    className={`text-xs tabular-nums ${
                      titleOver
                        ? "font-semibold text-[#ed1c24]"
                        : titleLen > 0
                          ? "font-medium text-emerald-700"
                          : "text-[#8b8d93]"
                    }`}
                  >
                    {titleLen}/{TITLE_LIMIT} ký tự{titleOver ? " · Vượt khuyến nghị" : ""}
                  </span>
                </div>
                <input
                  type="text"
                  value={value.metaTitle}
                  onChange={(e) => update(page.path, "metaTitle", e.target.value)}
                  disabled={isSaving}
                  className={`mt-1 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#14181f] focus:outline-none focus:ring-2 disabled:opacity-60 ${
                    titleOver
                      ? "border-[#ed1c24]/70 focus:border-[#ed1c24] focus:ring-[#ed1c24]/15"
                      : "border-[#e7e7e3] focus:border-[#f7941d] focus:ring-[#f7941d]/20"
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-ink/60">Mô tả (description)</label>
                  <span
                    className={`text-xs tabular-nums ${
                      descOver
                        ? "font-semibold text-[#ed1c24]"
                        : descLen > 0
                          ? "font-medium text-emerald-700"
                          : "text-[#8b8d93]"
                    }`}
                  >
                    {descLen}/{DESCRIPTION_LIMIT} ký tự{descOver ? " · Vượt khuyến nghị" : ""}
                  </span>
                </div>
                <textarea
                  value={value.metaDescription}
                  onChange={(e) => update(page.path, "metaDescription", e.target.value)}
                  rows={2}
                  disabled={isSaving}
                  className={`mt-1 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-[#14181f] focus:outline-none focus:ring-2 disabled:opacity-60 ${
                    descOver
                      ? "border-[#ed1c24]/70 focus:border-[#ed1c24] focus:ring-[#ed1c24]/15"
                      : "border-[#e7e7e3] focus:border-[#f7941d] focus:ring-[#f7941d]/20"
                  }`}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => save(page)}
              disabled={isSaving}
              className="btn-primary mt-4 disabled:opacity-50"
            >
              {isSaving ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
