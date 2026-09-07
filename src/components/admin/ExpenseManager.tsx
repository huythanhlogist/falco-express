"use client";

import { useState, useTransition } from "react";
import { PencilIcon, TrashIcon } from "@/components/icons";

type Expense = {
  id: number;
  description: string;
  amount: string;
  expense_date: string;
};

function toDatetimeLocal(value: string): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExpenseManager({ initialExpenses }: { initialExpenses: Expense[] }) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => toDatetimeLocal(new Date().toISOString()));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ description: string; amount: string; expenseDate: string } | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, amount, expenseDate }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Có lỗi xảy ra");
        return;
      }
      setExpenses((prev) =>
        [
          {
            id: json.id,
            description,
            amount,
            expense_date: expenseDate.replace("T", " ") + ":00",
          },
          ...prev,
        ].sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1))
      );
      setDescription("");
      setAmount("");
    });
  }

  function startEdit(exp: Expense) {
    setEditingId(exp.id);
    setEditDraft({
      description: exp.description,
      amount: exp.amount,
      expenseDate: toDatetimeLocal(exp.expense_date),
    });
  }

  function saveEdit(id: number) {
    if (!editDraft) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      if (res.ok) {
        setExpenses((prev) =>
          prev.map((exp) =>
            exp.id === id
              ? {
                  ...exp,
                  description: editDraft.description,
                  amount: editDraft.amount,
                  expense_date: editDraft.expenseDate.replace("T", " ") + ":00",
                }
              : exp
          )
        );
        setEditingId(null);
        setEditDraft(null);
      }
    });
  }

  function remove(id: number) {
    if (!confirm("Xoá chi phí này?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
      if (res.ok) setExpenses((prev) => prev.filter((exp) => exp.id !== id));
    });
  }

  return (
    <div>
      <form
        onSubmit={addExpense}
        className="flex flex-wrap items-end gap-2.5 rounded-xl border border-line bg-white p-3.5"
      >
        <div className="min-w-[180px] flex-1">
          <label className="text-xs font-semibold text-ink/60">Mô tả</label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="VD: Tiền xăng xe, thuê kho..."
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
          />
        </div>
        <div className="w-32">
          <label className="text-xs font-semibold text-ink/60">Số tiền</label>
          <input
            type="number"
            required
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink/60">Ngày giờ</label>
          <input
            type="datetime-local"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="mt-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
          />
        </div>
        <button type="submit" disabled={isPending} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">
          Thêm chi phí
        </button>
      </form>
      {error && <p className="mt-2 text-xs font-medium text-flame-700">{error}</p>}

      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="px-3 py-2">Mô tả</th>
              <th className="px-3 py-2">Số tiền</th>
              <th className="px-3 py-2">Ngày giờ</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                {editingId === exp.id && editDraft ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={editDraft.description}
                        onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                        className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={editDraft.amount}
                        onChange={(e) => setEditDraft({ ...editDraft, amount: e.target.value })}
                        className="w-28 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="datetime-local"
                        value={editDraft.expenseDate}
                        onChange={(e) => setEditDraft({ ...editDraft, expenseDate: e.target.value })}
                        className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(exp.id)}
                          disabled={isPending}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs font-semibold text-ink/50 hover:underline"
                        >
                          Huỷ
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-ink/80">{exp.description}</td>
                    <td className="px-3 py-2 font-semibold text-flame-700">
                      {Number(exp.amount).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-3 py-2 text-ink/70">
                      {new Date(exp.expense_date).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(exp)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-mist hover:text-navy-800"
                          title="Sửa"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(exp.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-flame-50 hover:text-flame-700"
                          title="Xoá"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-ink/45">
                  Chưa có chi phí phát sinh nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
