import type { Album } from "./albums";

export type Inline =
  | { kind: "text" | "em" | "strong"; text: string }
  | { kind: "link"; text: string; href: string };

const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    if (match[1] !== undefined) out.push({ kind: "strong", text: match[1] });
    else if (match[2] !== undefined) out.push({ kind: "em", text: match[2] });
    else if (/^(https?:|mailto:)/.test(match[4])) out.push({ kind: "link", text: match[3], href: match[4] });
    else out.push({ kind: "text", text: match[3] });
    last = at + match[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/**
 * Splits a write-up into paragraphs of styled runs. Blank lines separate
 * paragraphs, and the lines inside one are joined, so indentation and
 * wrapping in the source don't show.
 */
export function parseWriteup(source: string): Inline[][] {
  return source
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean)
    .map(parseInline);
}

/** Stand-in text for an album that has no write-up yet, about as long as a real one. */
export function placeholderWriteup(album: Album): string {
  return `
    This is where the write-up for *${album.title}* goes. Where were you when
    it found you? Who handed it over, and what were you trying to get away from
    or get back to in ${album.year}, or whenever it actually reached you?

    Write about the first listen and the hundredth. The song that took a year to
    land. The one you skipped until the day you couldn't. "${album.song}" is
    playing right now, so maybe start with why it's that one.

    Then the ending: what ${album.artist} gave you that you still carry around,
    and why this record sits exactly here on the list. **A sentence or two of
    conviction** goes a long way.
  `;
}

/** Stand-in for a missing lyric. It doesn't name the song, which would give the album away. */
export function placeholderLyric(): string {
  return "Your favorite line from this album goes here, for everyone to guess from.";
}
