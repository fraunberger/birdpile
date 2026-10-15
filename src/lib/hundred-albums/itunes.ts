/**
 * Finds an album's cover art and a preview of one of its songs with the
 * iTunes Search API (https://performance-partners.apple.com/search-api),
 * which needs no key and serves 30-second previews.
 */

export type AlbumQuery = { artist: string; album: string; song: string };

export type AlbumMedia = {
  /** Cover art, about 1200px square. */
  cover: string | null;
  /** The same cover, small: for the index and the blurred background. */
  thumb: string | null;
  /** A 30-second preview of the song. */
  preview: string | null;
  /** The previewed song's name as Apple has it. */
  previewTitle: string | null;
  /** The album on Apple Music. */
  appleUrl: string | null;
};

export type ItunesItem = {
  wrapperType?: string;
  kind?: string;
  collectionType?: string;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  collectionId?: number;
  artworkUrl100?: string;
  previewUrl?: string;
  collectionViewUrl?: string;
};

export type FetchItunes = (url: string) => Promise<ItunesItem[]>;

const SEARCH = "https://itunes.apple.com/search";
const LOOKUP = "https://itunes.apple.com/lookup";

/** Lowercase words only: no accents, apostrophes or punctuation. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['\u2019`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Words that mark a bracketed or dashed suffix as describing a release or a
// recording rather than being part of the name: "(Remastered 2009)",
// "- 2019 Mix", "(feat. Kai)", "[Deluxe Edition]".
const RELEASE_NOTE =
  /remaster|\bmix\b|version|\bedit\b|\bmono\b|stereo|deluxe|edition|anniversary|expanded|bonus|\bfeat\b|\bft\b|\bwith\b|single/i;

// Recordings nobody means unless they ask for them.
const ALTERNATE_TAKE =
  /\b(live|demo|acoustic|instrumental|karaoke|remix(ed)?|take \d+|anthology|rehearsal|sessions?|commentary|interview|tribute|covers?)\b/i;

/** A song's name without notes like "(Remastered 2009)" or "(feat. Kai)". */
export function songName(text: string): string {
  const cleaned = text
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (whole, inner: string) => (RELEASE_NOTE.test(inner) ? "" : whole))
    .replace(/\s+-\s+(.*)$/, (whole, rest: string) => (RELEASE_NOTE.test(rest) ? "" : whole));
  return normalize(cleaned);
}

/** An album's name without anything in brackets: "The Beatles (White Album)" is "the beatles". */
export function albumName(text: string): string {
  const cleaned = text
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/\s+-\s+(.*)$/, (whole, rest: string) => (RELEASE_NOTE.test(rest) ? "" : whole));
  return normalize(cleaned);
}

function artistWords(text: string): string[] {
  return normalize(text)
    .replace(/^the /, "")
    .split(" ")
    .filter(Boolean);
}

/** Whether Apple's artist credit includes everyone in `artist`, e.g. "Flume & Chet Faker" for "Flume". */
export function sameArtist(credit: string | undefined, artist: string): boolean {
  if (!credit) return false;
  const have = new Set(artistWords(credit));
  return artistWords(artist).every((word) => have.has(word));
}

function sizedArtwork(url: string | undefined, size: number): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+(bb)?(-\d+)?\.(jpg|jpeg|png|webp)$/i, `/${size}x${size}bb.jpg`);
}

function songScore(item: ItunesItem, query: AlbumQuery): number {
  if (!item.previewUrl || !item.trackName || !sameArtist(item.artistName, query.artist)) return 0;
  const want = songName(query.song);
  const have = songName(item.trackName);
  let score = have === want ? 100 : have.startsWith(`${want} `) ? 60 : 0;
  if (score === 0) return 0;
  if (item.collectionName && albumName(item.collectionName) === albumName(query.album)) score += 50;
  // Between equals, the plain recording: "Here Comes the Sun" before "Here
  // Comes the Sun (2019 Mix)", on "Abbey Road" before "Abbey Road (Super Deluxe)".
  if (normalize(item.trackName) === normalize(query.song)) score += 5;
  if (item.collectionName && normalize(item.collectionName) === normalize(query.album)) score += 3;
  if (ALTERNATE_TAKE.test(item.trackName) && !ALTERNATE_TAKE.test(query.song)) score -= 70;
  if (item.collectionName && ALTERNATE_TAKE.test(item.collectionName) && !ALTERNATE_TAKE.test(query.album)) score -= 30;
  return score;
}

function albumScore(item: ItunesItem, query: AlbumQuery): number {
  if (!item.collectionName || !sameArtist(item.artistName, query.artist)) return 0;
  if (albumName(item.collectionName) !== albumName(query.album)) return 0;
  // Of the matches, prefer the plainest name: "Abbey Road (Remastered)"
  // before "Abbey Road (Super Deluxe Edition)".
  let score = 100 - Math.min(40, Math.max(0, item.collectionName.length - query.album.length));
  if (normalize(item.collectionName) === normalize(query.album)) score += 10;
  if (ALTERNATE_TAKE.test(item.collectionName) && !ALTERNATE_TAKE.test(query.album)) score -= 50;
  return score;
}

function best<T>(items: T[], score: (item: T) => number): T | null {
  let top: T | null = null;
  let topScore = 0;
  for (const item of items) {
    const value = score(item);
    if (value > topScore) {
      top = item;
      topScore = value;
    }
  }
  return top;
}

/** The best track for `query` among search results, or null. */
export function pickSong(items: ItunesItem[], query: AlbumQuery): ItunesItem | null {
  return best(items, (item) => songScore(item, query));
}

/** The best album for `query` among search results, or null. */
export function pickAlbum(items: ItunesItem[], query: AlbumQuery): ItunesItem | null {
  return best(
    items.filter((item) => item.wrapperType === "collection" || item.collectionType === "Album"),
    (item) => albumScore(item, query),
  );
}

function searchUrl(term: string, entity: "song" | "album"): string {
  const params = new URLSearchParams({ term, media: "music", entity, limit: "50", country: "US" });
  return `${SEARCH}?${params}`;
}

/**
 * Looks up the album's cover and the song's preview. Usually one request:
 * searching for the song finds it on the album, which has the cover too.
 * When it doesn't, the album is searched for separately.
 */
export async function findAlbumMedia(query: AlbumQuery, fetchItunes: FetchItunes): Promise<AlbumMedia> {
  const media: AlbumMedia = { cover: null, thumb: null, preview: null, previewTitle: null, appleUrl: null };
  const albumMatches = (item: ItunesItem | null) =>
    !!item?.collectionName && albumName(item.collectionName) === albumName(query.album);

  const track = query.song ? pickSong(await fetchItunes(searchUrl(`${query.artist} ${query.song}`, "song")), query) : null;
  if (track) {
    media.preview = track.previewUrl ?? null;
    media.previewTitle = track.trackName ?? null;
  }

  let album: ItunesItem | null = albumMatches(track) ? track : null;
  if (!album) {
    album = pickAlbum(await fetchItunes(searchUrl(`${query.artist} ${query.album}`, "album")), query);
  }
  if (album) {
    media.cover = sizedArtwork(album.artworkUrl100, 1200);
    media.thumb = sizedArtwork(album.artworkUrl100, 300);
    media.appleUrl = album.collectionViewUrl ?? null;
  }

  // The song wasn't found anywhere: play something from the album instead.
  if (!media.preview && album?.collectionId) {
    const params = new URLSearchParams({ id: String(album.collectionId), entity: "song", country: "US" });
    const tracks = (await fetchItunes(`${LOOKUP}?${params}`)).filter((item) => item.wrapperType === "track");
    const fallback = pickSong(tracks, query) ?? tracks.find((item) => item.previewUrl) ?? null;
    media.preview = fallback?.previewUrl ?? null;
    media.previewTitle = fallback?.trackName ?? null;
  }

  return media;
}
