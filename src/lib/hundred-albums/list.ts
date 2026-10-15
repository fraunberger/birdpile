import type { Album } from "./albums";

/** Where the page can send someone: the top of a part, or one album. */
export type Target = { kind: "part"; page: number } | { kind: "album"; index: number };

export type Layout = { total: number; pageSize: number; countDown: boolean };

/** The number printed next to the album at `index` in the list. */
export function albumNumber(index: number, layout: Layout): number {
  return layout.countDown ? layout.total - index : index + 1;
}

export function indexOfNumber(number: number, layout: Layout): number {
  return layout.countDown ? layout.total - number : number - 1;
}

export function pageCount(layout: Layout): number {
  return Math.max(1, Math.ceil(layout.total / layout.pageSize));
}

export function pageOf(index: number, layout: Layout): number {
  return Math.floor(index / layout.pageSize);
}

/** List indexes `[start, end)` on a page. */
export function pageBounds(page: number, layout: Layout): [number, number] {
  const start = page * layout.pageSize;
  return [start, Math.min(start + layout.pageSize, layout.total)];
}

/** "Nos. 100–91", the way the page names a part. */
export function pageLabel(page: number, layout: Layout): string {
  const [start, end] = pageBounds(page, layout);
  const first = albumNumber(start, layout);
  const last = albumNumber(end - 1, layout);
  return first === last ? `No. ${first}` : `Nos. ${first}–${last}`;
}

/** `#no-87` is album No. 87, `#part-3` the top of part 3, anything else the top of the page. */
export function parseHash(hash: string, layout: Layout): Target {
  const album = /^#no-(\d+)$/.exec(hash);
  if (album) {
    const index = indexOfNumber(Number(album[1]), layout);
    if (index >= 0 && index < layout.total) return { kind: "album", index };
  }
  const part = /^#part-(\d+)$/.exec(hash);
  if (part) {
    const page = Number(part[1]) - 1;
    if (page >= 0 && page < pageCount(layout)) return { kind: "part", page };
  }
  return { kind: "part", page: 0 };
}

export function hashFor(target: Target, layout: Layout): string {
  if (target.kind === "album") return `#no-${albumNumber(target.index, layout)}`;
  return target.page === 0 ? "" : `#part-${target.page + 1}`;
}

export function targetPage(target: Target, layout: Layout): number {
  return target.kind === "album" ? pageOf(target.index, layout) : target.page;
}

/** A stable id for an album, used for caching its cover and preview. */
export function albumKey(album: Pick<Album, "artist" | "title" | "song">): string {
  return [album.artist, album.title, album.song]
    .map((part) =>
      part
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .join("~");
}
