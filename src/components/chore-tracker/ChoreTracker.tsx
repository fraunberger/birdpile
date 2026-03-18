"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Check, Plus } from "lucide-react";

type Chore = {
  id: string;
  name: string;
  frequency_days: number;
  last_done_at: string | null;
  created_at: string;
};

function getDaysUntilDue(lastDoneAt: string | null, frequencyDays: number): number | null {
  if (!lastDoneAt) return null;
  const dueDate = new Date(lastDoneAt);
  dueDate.setDate(dueDate.getDate() + frequencyDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatFrequency(days: number): string {
  if (days % 30 === 0) return `every ${days / 30} month${days / 30 === 1 ? "" : "s"}`;
  if (days % 7 === 0) return `every ${days / 7} week${days / 7 === 1 ? "" : "s"}`;
  return `every ${days} day${days === 1 ? "" : "s"}`;
}

function StatusBadge({ daysUntilDue }: { daysUntilDue: number | null }) {
  if (daysUntilDue === null) {
    return <span className="text-xs text-gray-400 font-mono">never done</span>;
  }
  if (daysUntilDue < 0) {
    return (
      <span className="text-xs text-red-600 font-mono font-bold">
        {Math.abs(daysUntilDue)}d overdue
      </span>
    );
  }
  if (daysUntilDue === 0) {
    return <span className="text-xs text-orange-500 font-mono font-bold">due today</span>;
  }
  if (daysUntilDue <= 7) {
    return <span className="text-xs text-amber-600 font-mono">due in {daysUntilDue}d</span>;
  }
  return <span className="text-xs text-green-700 font-mono">due in {daysUntilDue}d</span>;
}

export function ChoreTracker() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newFreqNum, setNewFreqNum] = useState("1");
  const [newFreqUnit, setNewFreqUnit] = useState<"days" | "weeks" | "months">("months");
  const [newLastDone, setNewLastDone] = useState("");
  const [adding, setAdding] = useState(false);

  const [completing, setCompleting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchChores = useCallback(async () => {
    const res = await fetch("/api/chores");
    const data = await res.json();
    setChores(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChores();
  }, [fetchChores]);

  const sortedChores = [...chores].sort((a, b) => {
    const da = getDaysUntilDue(a.last_done_at, a.frequency_days);
    const db = getDaysUntilDue(b.last_done_at, b.frequency_days);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

  const handleMarkDone = async (id: string) => {
    setCompleting(id);
    await fetch(`/api/chores/${id}/complete`, { method: "PATCH" });
    await fetchChores();
    setCompleting(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await fetch(`/api/chores/${id}`, { method: "DELETE" });
    setChores((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newFreqNum) return;

    setAdding(true);
    const multiplier = newFreqUnit === "months" ? 30 : newFreqUnit === "weeks" ? 7 : 1;
    const frequency_days = parseInt(newFreqNum) * multiplier;

    await fetch("/api/chores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        frequency_days,
        last_done_at: newLastDone || null,
      }),
    });

    setNewName("");
    setNewFreqNum("1");
    setNewFreqUnit("months");
    setNewLastDone("");
    await fetchChores();
    setAdding(false);
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold font-mono mb-1">Chore Tracker</h1>
      <p className="text-sm text-gray-500 font-mono mb-6">Monthly chore tracker</p>

      {loading ? (
        <p className="text-gray-400 font-mono text-sm">Loading...</p>
      ) : sortedChores.length === 0 ? (
        <p className="text-gray-400 font-mono text-sm">No chores yet. Add one below.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {sortedChores.map((chore) => {
            const daysUntilDue = getDaysUntilDue(chore.last_done_at, chore.frequency_days);
            return (
              <div key={chore.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-medium text-sm">{chore.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400 font-mono">
                      {formatFrequency(chore.frequency_days)}
                    </span>
                    <span className="text-gray-300">·</span>
                    <StatusBadge daysUntilDue={daysUntilDue} />
                  </div>
                </div>
                <button
                  onClick={() => handleMarkDone(chore.id)}
                  disabled={completing === chore.id}
                  className="flex items-center gap-1 text-xs font-mono px-2 py-1 border border-black hover:bg-black hover:text-white transition-colors disabled:opacity-40 shrink-0"
                  title="Mark done"
                >
                  <Check size={12} />
                  done
                </button>
                <button
                  onClick={() => handleDelete(chore.id)}
                  disabled={deleting === chore.id}
                  className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 shrink-0"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleAdd} className="mt-8 border-t border-gray-200 pt-6">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-3">
          Add chore
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Chore name"
            className="border border-gray-300 font-mono text-sm px-3 py-2 w-full focus:outline-none focus:border-black"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={newFreqNum}
              onChange={(e) => setNewFreqNum(e.target.value)}
              className="border border-gray-300 font-mono text-sm px-3 py-2 w-20 focus:outline-none focus:border-black"
            />
            <select
              value={newFreqUnit}
              onChange={(e) => setNewFreqUnit(e.target.value as "days" | "weeks" | "months")}
              className="border border-gray-300 font-mono text-sm px-3 py-2 focus:outline-none focus:border-black flex-1"
            >
              <option value="days">days</option>
              <option value="weeks">weeks</option>
              <option value="months">months</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono text-gray-400">Last done (optional)</label>
            <input
              type="date"
              value={newLastDone}
              onChange={(e) => setNewLastDone(e.target.value)}
              className="border border-gray-300 font-mono text-sm px-3 py-2 w-full focus:outline-none focus:border-black"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="flex items-center justify-center gap-2 font-mono text-sm border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
          >
            <Plus size={14} />
            Add chore
          </button>
        </div>
      </form>
    </div>
  );
}
