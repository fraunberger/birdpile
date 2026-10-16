import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { findAlbumMedia, type ItunesItem } from "@/lib/hundred-albums/itunes";

// Apple rarely changes a cover or a preview, and its search API allows only
// about 20 requests a minute, so answers are kept for a month: upstream in the
// data cache and downstream at the CDN.
const MONTH = 60 * 60 * 24 * 30;

class UpstreamError extends Error {}

async function fetchItunes(url: string): Promise<ItunesItem[]> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Birdpile/1.0 (100 albums retrospective)" },
    next: { revalidate: MONTH },
  });
  if (!response.ok) throw new UpstreamError(`iTunes answered ${response.status}`);
  const data = (await response.json()) as { results?: ItunesItem[] };
  return data.results ?? [];
}

/** GET /api/albums/media?artist=…&album=…&song=… → the album's cover and a preview of the song. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist")?.trim() ?? "";
  const album = searchParams.get("album")?.trim() ?? "";
  const song = searchParams.get("song")?.trim() ?? "";

  if (!artist || !album || [artist, album, song].some((value) => value.length > 200)) {
    return NextResponse.json({ error: "artist and album are required" }, { status: 400 });
  }

  if (!rateLimit(`albums:${getClientIp(request)}`, 120).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const media = await findAlbumMedia({ artist, album, song }, fetchItunes);
    // Something missing may just be a typo that gets fixed, so recheck daily.
    const maxAge = media.cover && media.preview ? MONTH : 60 * 60 * 24;
    return NextResponse.json(media, {
      headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${MONTH}` },
    });
  } catch (error) {
    console.error("Album media lookup failed:", error);
    return NextResponse.json(
      { error: "Apple Music lookup failed" },
      { status: error instanceof UpstreamError ? 502 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
