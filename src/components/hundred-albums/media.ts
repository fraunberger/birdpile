import { useEffect, useSyncExternalStore } from "react";
import type { Album } from "@/lib/hundred-albums/albums";
import type { AlbumMedia } from "@/lib/hundred-albums/itunes";
import { albumKey, ownFile } from "@/lib/hundred-albums/list";

/**
 * Covers and previews for the albums on screen, shared by everything that
 * shows them. Apple answers only about 20 lookups a minute and refuses the
 * rest, so lookups go through /api/albums/media two at a time, only for
 * albums still on or near the screen, newest first (the album the reader just
 * reached, not the ones a fast scroll flew past). When Apple refuses, every
 * lookup waits out the limit before trying again. Answers are remembered in
 * this browser for a week, so a second visit asks for nothing.
 */

type Entry = { status: "loading" } | { status: "ready"; media: AlbumMedia } | { status: "failed"; at: number };
type Job = { key: string; album: Album; attempt: number };

const STORAGE_KEY = "birdpile.hundredAlbums.media.v1";
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const PARALLEL = 2;
const RETRIES = 2;
/** How soon an album whose lookup failed may be tried again, when it's back on screen. */
const RETRY_FAILED_MS = 60_000;

const entries = new Map<string, Entry>();
/** How many things on the page want each album right now. */
const wanted = new Map<string, number>();
const listeners = new Set<() => void>();
const queue: Job[] = [];
let running = 0;
let pausedUntil = 0;
let wakeTimer: ReturnType<typeof setTimeout> | undefined;
let stored: Record<string, { at: number; media: AlbumMedia }> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStorage() {
  if (stored) return stored;
  stored = {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    const now = Date.now();
    for (const [key, value] of Object.entries(saved as typeof stored)) {
      if (value && now - value.at < KEEP_MS) stored[key] = value;
    }
  } catch {
    // Unreadable or unavailable: look everything up again.
  }
  return stored;
}

function remember(key: string, media: AlbumMedia) {
  const saved = readStorage();
  saved[key] = { at: Date.now(), media };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or blocked: it's only a cache.
  }
}

function want(key: string, change: number) {
  const count = (wanted.get(key) ?? 0) + change;
  if (count > 0) wanted.set(key, count);
  else wanted.delete(key);
}

/** One try: the media, "bad" for a request that will never work, or "again" (most likely Apple's limit). */
async function lookUp(album: Album): Promise<AlbumMedia | "bad" | "again"> {
  const params = new URLSearchParams({ artist: album.artist, album: album.title, song: album.song });
  const response = await fetch(`/api/albums/media?${params}`).catch(() => null);
  if (response?.ok) return (await response.json()) as AlbumMedia;
  return response?.status === 400 ? "bad" : "again";
}

function pump() {
  const wait = pausedUntil - Date.now();
  if (wait > 0) {
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(pump, wait);
    return;
  }
  while (running < PARALLEL && queue.length > 0) {
    const job = queue.pop()!;
    if (!wanted.get(job.key)) {
      // Scrolled past before its turn: forget it until it's wanted again.
      entries.delete(job.key);
      emit();
      continue;
    }
    running++;
    lookUp(job.album)
      .then((result) => {
        if (typeof result === "object") {
          entries.set(job.key, { status: "ready", media: result });
          // Something missing may be fixed on the server soon; ask again next visit.
          if (result.cover && result.preview) remember(job.key, result);
        } else if (result === "bad" || job.attempt >= RETRIES) {
          entries.set(job.key, { status: "failed", at: Date.now() });
        } else {
          // Wait out Apple's minute, then try this one first.
          pausedUntil = Math.max(pausedUntil, Date.now() + (job.attempt === 0 ? 20_000 : 60_000));
          queue.push({ ...job, attempt: job.attempt + 1 });
        }
      })
      .finally(() => {
        running--;
        emit();
        pump();
      });
  }
}

/** Makes the album's media available: from this browser's cache, or with a lookup if `lookUpIfMissing`. */
function request(album: Album, lookUpIfMissing: boolean) {
  const key = albumKey(album);
  const entry = entries.get(key);
  const retry = lookUpIfMissing && entry?.status === "failed" && Date.now() - entry.at > RETRY_FAILED_MS;
  if (entry && !retry) return;
  const saved = readStorage()[key];
  if (saved) {
    entries.set(key, { status: "ready", media: saved.media });
  } else if (!lookUpIfMissing) {
    return;
  } else if (album.cover && album.audio) {
    entries.set(key, {
      status: "ready",
      media: { cover: null, thumb: null, preview: null, previewTitle: null, appleUrl: null },
    });
  } else {
    entries.set(key, { status: "loading" });
    queue.push({ key, album, attempt: 0 });
    pump();
  }
  emit();
}

export type MediaState = {
  status: "idle" | "loading" | "ready" | "failed";
  cover: string | null;
  thumb: string | null;
  preview: string | null;
  previewTitle: string | null;
  appleUrl: string | null;
};

/**
 * The album's cover and preview, looked up while `load` is true; otherwise
 * only what this browser already has. A `cover` or `audio` file set on the
 * album itself wins over Apple's.
 */
export function useAlbumMedia(album: Album | null, load = true): MediaState {
  const key = album ? albumKey(album) : "";
  const entry = useSyncExternalStore(
    subscribe,
    () => entries.get(key),
    () => undefined,
  );

  useEffect(() => {
    if (!album) return;
    if (!load) {
      request(album, false);
      return;
    }
    const albumId = albumKey(album);
    want(albumId, 1);
    request(album, true);
    return () => want(albumId, -1);
  }, [album, load]);

  const media = entry?.status === "ready" ? entry.media : null;
  const cover = ownFile(album?.cover);
  const audio = ownFile(album?.audio);
  return {
    status: cover && audio ? "ready" : (entry?.status ?? "idle"),
    cover: cover ?? media?.cover ?? null,
    thumb: cover ?? media?.thumb ?? null,
    preview: audio ?? media?.preview ?? null,
    previewTitle: audio ? (album?.song ?? null) : (media?.previewTitle ?? null),
    appleUrl: media?.appleUrl ?? null,
  };
}
