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
  if (days % 30 === 0) return `${days / 30}mo`;
  if (days % 7 === 0) return `${days / 7}wk`;
  return `${days}d`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function NextDueCell({ daysUntilDue, lastDoneAt, frequencyDays }: {
  daysUntilDue: number | null;
  lastDoneAt: string | null;
  frequencyDays: number;
}) {
  if (!lastDoneAt) {
    return <span className="text-gray-400">—</span>;
  }

  const dueDate = new Date(lastDoneAt);
  dueDate.setDate(dueDate.getDate() + frequencyDays);
  const dateLabel = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (daysUntilDue === null) return <span className="text-gray-400">—</span>;

  if (daysUntilDue < 0) {
    return (
      <span className="text-red-600 font-medium">
        {dateLabel} <span className="text-xs">({Math.abs(daysUntilDue)}d ago)</span>
      </span>
    );
  }
  if (daysUntilDue === 0) {
    return <span className="text-orange-500 font-medium">{dateLabel} (today)</span>;
  }
  if (daysUntilDue <= 7) {
    return <span className="text-amber-600">{dateLabel} <span className="text-xs">({daysUntilDue}d)</span></span>;
  }
  return <span className="text-gray-700">{dateLabel} <span className="text-xs text-gray-400">({daysUntilDue}d)</span></span>;
}

export function ChoreTracker() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newFreqNum, setNewFreqNum] = useState("1");
  const [newFreqUnit, setNewFreqUnit] = useState<"days" | "weeks" | "months">("months");
  const [newLastDone, setNewLastDone] = useState("");
  const [adding, setAdding] = useState(false);

  const [completing, setCompleting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchChores = useCallback(async () => {
    try {
      const res = await fetch("/api/chores");
      const text = await res.text();
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
        throw new Error(msg);
      }
      const data = text ? JSON.parse(text) : [];
      setChores(data);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load chores");
    } finally {
      setLoading(false);
    }
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
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold font-mono mb-6">Chore Tracker</h1>

      {loading && <p className="text-gray-400 font-mono text-sm">Loading...</p>}

      {loadError && (
        <p className="text-red-600 font-mono text-sm">Error: {loadError}</p>
      )}

      {!loading && !loadError && (
        <table className="w-full text-sm font-mono border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="pb-2 pr-4 font-semibold">Chore</th>
              <th className="pb-2 pr-4 font-semibold">Every</th>
              <th className="pb-2 pr-4 font-semibold">Last Done</th>
              <th className="pb-2 pr-4 font-semibold">Next Due</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {sortedChores.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-gray-400">
                  No chores yet. Add one below.
                </td>
              </tr>
            ) : (
              sortedChores.map((chore) => {
                const daysUntilDue = getDaysUntilDue(chore.last_done_at, chore.frequency_days);
                return (
                  <tr key={chore.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 font-medium">{chore.name}</td>
                    <td className="py-2 pr-4 text-gray-500">{formatFrequency(chore.frequency_days)}</td>
                    <td className="py-2 pr-4 text-gray-500">{formatDate(chore.last_done_at)}</td>
                    <td className="py-2 pr-4">
                      <NextDueCell
                        daysUntilDue={daysUntilDue}
                        lastDoneAt={chore.last_done_at}
                        frequencyDays={chore.frequency_days}
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleMarkDone(chore.id)}
                          disabled={completing === chore.id}
                          className="flex items-center gap-1 text-xs px-2 py-1 border border-black hover:bg-black hover:text-white transition-colors disabled:opacity-40"
                        >
                          <Check size={11} />
                          done
                        </button>
                        <button
                          onClick={() => handleDelete(chore.id)}
                          disabled={deleting === chore.id}
                          className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}

      <form onSubmit={handleAdd} className="mt-8 border-t border-gray-200 pt-6">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-3">Add chore</div>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Chore name"
            className="border border-gray-300 font-mono text-sm px-3 py-2 focus:outline-none focus:border-black w-48"
          />
          <input
            type="number"
            min="1"
            value={newFreqNum}
            onChange={(e) => setNewFreqNum(e.target.value)}
            className="border border-gray-300 font-mono text-sm px-3 py-2 focus:outline-none focus:border-black w-16"
          />
          <select
            value={newFreqUnit}
            onChange={(e) => setNewFreqUnit(e.target.value as "days" | "weeks" | "months")}
            className="border border-gray-300 font-mono text-sm px-3 py-2 focus:outline-none focus:border-black"
          >
            <option value="days">days</option>
            <option value="weeks">weeks</option>
            <option value="months">months</option>
          </select>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono text-gray-400">Last done</label>
            <input
              type="date"
              value={newLastDone}
              onChange={(e) => setNewLastDone(e.target.value)}
              className="border border-gray-300 font-mono text-sm px-3 py-2 focus:outline-none focus:border-black"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="flex items-center gap-1 font-mono text-sm border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
          >
            <Plus size={13} />
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
