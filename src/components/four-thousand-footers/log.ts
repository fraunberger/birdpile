// The ascent log and where it lives.
//
// For now the log is kept in this browser's localStorage. Everything that
// touches storage is in the "Persistence" section at the bottom; when accounts
// arrive, that section is the part to swap for a per-user API, and the rest of
// the app (which only sees `PeakLog` and the actions) doesn't change.

import { PEAK_BY_ID } from "./peaks";

export type Ascent = {
    id: string;
    peakId: string;
    /** Local calendar date, YYYY-MM-DD. */
    date: string;
    notes: string;
};

export type PeakLog = {
    version: 1;
    ascents: Ascent[];
};

export const EMPTY_LOG: PeakLog = { version: 1, ascents: [] };

// --- Dates ---

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date in YYYY-MM-DD form (no Feb 30th). */
export function isValidDate(value: string): boolean {
    const match = DATE_PATTERN.exec(value);
    if (!match) return false;
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

/** Today in the hiker's own time zone. */
export function todayISO(now: Date = new Date()): string {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-08-12" -> "Aug 12, 2025". Locale-free so server and client agree. */
export function formatDate(iso: string): string {
    const match = DATE_PATTERN.exec(iso);
    if (!match) return iso;
    return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
}

export function monthName(index: number): string {
    return MONTHS[index];
}

// --- Pure log operations ---

function byDate(a: Ascent, b: Ascent): number {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sorted(ascents: Ascent[]): Ascent[] {
    return [...ascents].sort(byDate);
}

/**
 * Accepts anything (a saved log, an imported file) and keeps only well-formed
 * ascents of real peaks on real dates. Never throws.
 */
export function parseLog(raw: unknown): PeakLog {
    const list = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object" && Array.isArray((raw as { ascents?: unknown }).ascents)
          ? (raw as { ascents: unknown[] }).ascents
          : [];
    const seen = new Set<string>();
    const ascents: Ascent[] = [];
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const { id, peakId, date, notes } = item as Record<string, unknown>;
        if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
        if (typeof peakId !== "string" || !PEAK_BY_ID.has(peakId)) continue;
        if (typeof date !== "string" || !isValidDate(date)) continue;
        seen.add(id);
        ascents.push({ id, peakId, date, notes: typeof notes === "string" ? notes : "" });
    }
    return { version: 1, ascents: sorted(ascents) };
}

export function withAscent(log: PeakLog, ascent: Ascent): PeakLog {
    return { version: 1, ascents: sorted([...log.ascents.filter((a) => a.id !== ascent.id), ascent]) };
}

export function withAscentChanged(
    log: PeakLog,
    id: string,
    change: Partial<Pick<Ascent, "date" | "notes">>
): PeakLog {
    if (change.date !== undefined && !isValidDate(change.date)) return log;
    return {
        version: 1,
        ascents: sorted(log.ascents.map((a) => (a.id === id ? { ...a, ...change } : a))),
    };
}

export function withoutAscent(log: PeakLog, id: string): PeakLog {
    return { version: 1, ascents: log.ascents.filter((a) => a.id !== id) };
}

export function withoutPeak(log: PeakLog, peakId: string): PeakLog {
    return { version: 1, ascents: log.ascents.filter((a) => a.peakId !== peakId) };
}

/**
 * Folds an imported log into this one. Entries already here (same id, or the
 * same peak, date and notes) are skipped, so importing a backup twice is harmless.
 */
export function mergeLogs(log: PeakLog, incoming: PeakLog): { log: PeakLog; added: number } {
    const ids = new Set(log.ascents.map((a) => a.id));
    const keys = new Set(log.ascents.map((a) => `${a.peakId}|${a.date}|${a.notes}`));
    const fresh = incoming.ascents.filter(
        (a) => !ids.has(a.id) && !keys.has(`${a.peakId}|${a.date}|${a.notes}`)
    );
    return { log: { version: 1, ascents: sorted([...log.ascents, ...fresh]) }, added: fresh.length };
}

export function newAscentId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ?? `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- Persistence (this browser, for now) ---

const STORAGE_KEY = "birdpile.nh48.log.v1";

let cache: PeakLog | null = null;
const listeners = new Set<() => void>();

function read(): PeakLog {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? parseLog(JSON.parse(raw)) : EMPTY_LOG;
    } catch {
        return EMPTY_LOG;
    }
}

/** Snapshot for useSyncExternalStore; stable until the log changes. */
export function getLog(): PeakLog {
    if (cache === null) cache = read();
    return cache;
}

/** Nothing is known about the log during server rendering. */
export function getServerLog(): PeakLog {
    return EMPTY_LOG;
}

export function subscribeLog(listener: () => void): () => void {
    listeners.add(listener);
    // Another tab wrote the log: drop the cache and re-read.
    const onStorage = (event: StorageEvent) => {
        if (event.key !== STORAGE_KEY) return;
        cache = null;
        listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
    };
}

let saveFailed = false;

/** True once a write to localStorage has failed (private mode, storage full). */
export function getSaveFailed(): boolean {
    return saveFailed;
}

function commit(next: PeakLog): void {
    cache = next;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        saveFailed = false;
    } catch {
        // Keep working from memory; the UI warns that nothing is being saved.
        saveFailed = true;
    }
    listeners.forEach((listener) => listener());
}

export const logActions = {
    add(peakId: string, date: string, notes = ""): void {
        if (!PEAK_BY_ID.has(peakId) || !isValidDate(date)) return;
        commit(withAscent(getLog(), { id: newAscentId(), peakId, date, notes: notes.trim() }));
    },
    update(id: string, change: Partial<Pick<Ascent, "date" | "notes">>): void {
        commit(withAscentChanged(getLog(), id, change));
    },
    remove(id: string): void {
        commit(withoutAscent(getLog(), id));
    },
    removePeak(peakId: string): void {
        commit(withoutPeak(getLog(), peakId));
    },
    /** Merge an imported backup; returns how many ascents were new. */
    merge(incoming: PeakLog): number {
        const { log, added } = mergeLogs(getLog(), incoming);
        if (added > 0) commit(log);
        return added;
    },
};
