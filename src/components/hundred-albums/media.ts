import { useEffect, useSyncExternalStore } from "react";
import type { Album } from "@/lib/hundred-albums/albums";
import type { AlbumMedia } from "@/lib/hundred-albums/itunes";
import { albumKey } from "@/lib/hundred-albums/list";

/**
 * Covers and previews for the albums on screen, shared by everything that
 * shows them. Lookups go through /api/albums/media a few at a time and are
 * remembered in this browser for a week, so a second visit asks for nothing.
 */

type Entry = { status: "loading" } | { status: "ready"; media: AlbumMedia } | { status: "failed" };

const STORAGE_KEY = "birdpile.hundredAlbums.media.v1";
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const PARALLEL = 3;
const RETRIES = 2;

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const queue: { key: string; album: Album }[] = [];
let running = 0;
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

async function lookUp(album: Album): Promise<AlbumMedia> {
  const params = new URLSearchParams({ artist: album.artist, album: album.title, song: album.song });
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`/api/albums/media?${params}`);
    if (response.ok) return (await response.json()) as AlbumMedia;
    if (attempt >= RETRIES || response.status === 400) throw new Error(`Lookup failed: ${response.status}`);
    // Apple limits how often it may be asked; give it a moment.
    await new Promise((resolve) => setTimeout(resolve, 4000 * (attempt + 1)));
  }
}

function pump() {
  while (running < PARALLEL && queue.length > 0) {
    const { key, album } = queue.shift()!;
    running++;
    lookUp(album)
      .then((media) => {
        entries.set(key, { status: "ready", media });
        remember(key, media);
      })
      .catch(() => entries.set(key, { status: "failed" }))
      .finally(() => {
        running--;
        emit();
        pump();
      });
  }
}

function request(album: Album) {
  const key = albumKey(album);
  if (entries.has(key)) return;
  const saved = readStorage()[key];
  if (saved) {
    entries.set(key, { status: "ready", media: saved.media });
  } else if (album.cover && album.preview) {
    entries.set(key, {
      status: "ready",
      media: { cover: null, thumb: null, preview: null, previewTitle: null, appleUrl: null },
    });
  } else {
    entries.set(key, { status: "loading" });
    queue.push({ key, album });
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
 * The album's cover and preview, looked up once `load` is true. A `cover` or
 * `preview` set on the album itself wins over Apple's.
 */
export function useAlbumMedia(album: Album | null, load = true): MediaState {
  const key = album ? albumKey(album) : "";
  const entry = useSyncExternalStore(
    subscribe,
    () => entries.get(key),
    () => undefined,
  );

  useEffect(() => {
    if (album && load) request(album);
  }, [album, load]);

  const media = entry?.status === "ready" ? entry.media : null;
  return {
    status: album?.cover && album.preview ? "ready" : (entry?.status ?? "idle"),
    cover: album?.cover ?? media?.cover ?? null,
    thumb: album?.cover ?? media?.thumb ?? null,
    preview: album?.preview ?? media?.preview ?? null,
    previewTitle: album?.preview ? album.song : (media?.previewTitle ?? null),
    appleUrl: media?.appleUrl ?? null,
  };
}
