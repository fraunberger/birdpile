import type { Album } from "./albums";

export type Layout = { total: number; countDown: boolean; jumpSize: number };

/** The number printed next to the album at `index` in the list. */
export function albumNumber(index: number, layout: Layout): number {
  return layout.countDown ? layout.total - index : index + 1;
}

export function indexOfNumber(number: number, layout: Layout): number {
  return layout.countDown ? layout.total - number : number - 1;
}

export type JumpRange = { label: string; first: number; last: number; index: number };

/**
 * Shortcuts into the list: 1–20, 21–40 and so on, smallest numbers first.
 * Each goes to the album of its range that comes first while scrolling, which
 * on a countdown is its highest number (1–20 starts at No. 20).
 */
export function jumpRanges(layout: Layout): JumpRange[] {
  const ranges: JumpRange[] = [];
  for (let first = 1; first <= layout.total; first += layout.jumpSize) {
    const last = Math.min(first + layout.jumpSize - 1, layout.total);
    ranges.push({
      label: first === last ? `${first}` : `${first}\u2013${last}`,
      first,
      last,
      index: indexOfNumber(layout.countDown ? last : first, layout),
    });
  }
  return ranges;
}

/** The id of an album's section, and the #fragment that links to it: "no-87". */
export function albumAnchor(index: number, layout: Layout): string {
  return `no-${albumNumber(index, layout)}`;
}

/** A stable id for an album, used for caching its cover and preview. */
export function albumKey(album: Pick<Album, "artist" | "title" | "song">): string {
  return [album.artist, album.title, album.song]
    .map((part) =>
      part
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/['\u2019]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .join("~");
}

/** An album's own `cover` or `audio`: "blackbird.mp3" is a file in public/albums/, a path or URL is used as is. */
export function ownFile(name: string | undefined): string | null {
  if (!name) return null;
  return /^(https?:|data:|blob:|\/)/.test(name) ? name : `/albums/${encodeURIComponent(name)}`;
}

export type YouTubeVideo = { id: string; start: number };

function seconds(value: string | null): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  return parts ? Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0) : 0;
}

/**
 * The video in a YouTube link, as pasted from the share button or the
 * address bar (youtube.com/watch?v=…, youtu.be/…, music.youtube.com, /embed/,
 * /shorts/), or a bare video id. A ?t= start time is kept.
 */
export function youtubeVideo(link: string | undefined): YouTubeVideo | null {
  const value = link?.trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return { id: value, start: 0 };
  let url: URL;
  try {
    url = new URL(/^https?:/.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? /^\/(?:embed|shorts|live|v)\/([\w-]+)/.exec(url.pathname)?.[1] ?? null;
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  return { id, start: seconds(url.searchParams.get("t") ?? url.searchParams.get("start")) };
}
