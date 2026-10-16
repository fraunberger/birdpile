/**
 * The 100 Albums of My Life: everything the page says lives in this file.
 *
 * Each album is a little guessing game. Its lyric shows over the cover,
 * blurred past recognizing; scrolling brings the cover into focus with its
 * name, then the write-up.
 *
 * List the albums in the order they should appear. With `countDown` on, the
 * first album in the list gets the highest number and the last one is No. 1.
 *
 * For each album you only need the artist, title, year and the song that
 * plays while it is on screen. The cover art and a 30-second preview of that
 * song are looked up on Apple Music, so spell them the way Apple does.
 *
 * Your own files: put them in public/albums/ and name them on the album, e.g.
 * `audio: "blackbird.mp3"` or `cover: "white-album.jpg"`. They're used
 * instead of Apple's, and with both set nothing is looked up. Full URLs work
 * too.
 *
 * Write-ups: a blank line starts a new paragraph. *italics*, **bold** and
 * [links](https://example.com) work. Line breaks inside a paragraph don't
 * matter, so wrap the text however you like.
 */

export type Album = {
  artist: string;
  title: string;
  year: number;
  /** The song that plays while the album is on screen. */
  song: string;
  /** A line from the album, shown over the blurred cover for guessing. */
  lyric?: string;
  writeup?: string;
  /** Your own cover image: a file in public/albums/ ("abbey-road.jpg") or a URL. */
  cover?: string;
  /** Your own song file: a file in public/albums/ ("blackbird.mp3") or a URL. */
  audio?: string;
};

export const RETROSPECTIVE = {
  title: "The 100 Albums",
  titleSecondLine: "of My Life",
  kicker: "A personal retrospective",
  dek: "The records that raised me, wrecked me and kept me company. Each one starts as a lyric over a blurred cover: guess it, then scroll to see if you were right.",
  byline: "By Michael Fraunberger",
  dateline: "October 2026",
  /** Shown under the title before the first album. Leave empty to skip it. */
  intro: `
    This is where the introduction goes: why a hundred, how they were picked,
    and what counts as an album "of my life."

    Keep it short. The albums do the talking.
  `,
  /** Number from the top of the list down to No. 1. */
  countDown: true,
  /** Albums per part. Each part is its own page. */
  pageSize: 10,
};

export const ALBUMS: Album[] = [
  { artist: "The Beatles", title: "Please Please Me", year: 1963, song: "I Saw Her Standing There" },
  { artist: "Flume", title: "Hi This Is Flume", year: 2019, song: "Jewel" },
  { artist: "Noah Kahan", title: "Busyhead", year: 2019, song: "Hurt Somebody" },
  { artist: "The Beatles", title: "With the Beatles", year: 1963, song: "All My Loving" },
  { artist: "Bon Iver", title: "SABLE, fABLE", year: 2025, song: "Everything Is Peaceful Love" },
  { artist: "The Beatles", title: "Beatles for Sale", year: 1964, song: "Eight Days a Week" },
  { artist: "Flume", title: "Palaces", year: 2022, song: "Say Nothing" },
  { artist: "The Beatles", title: "Yellow Submarine", year: 1969, song: "Hey Bulldog" },
  { artist: "Noah Kahan", title: "I Was / I Am", year: 2021, song: "Godlight" },
  { artist: "The Beatles", title: "Help!", year: 1965, song: "Help!" },
  { artist: "Bon Iver", title: "i,i", year: 2019, song: "Hey, Ma" },
  { artist: "The Beatles", title: "Magical Mystery Tour", year: 1967, song: "Strawberry Fields Forever" },
  { artist: "Phoebe Bridgers", title: "Stranger in the Alps", year: 2017, song: "Motion Sickness" },
  { artist: "The Beatles", title: "A Hard Day's Night", year: 1964, song: "A Hard Day's Night" },
  { artist: "Flume", title: "Flume", year: 2012, song: "Holdin On" },
  { artist: "The Beatles", title: "Let It Be", year: 1970, song: "Let It Be" },
  { artist: "Bon Iver", title: "22, A Million", year: 2016, song: "8 (circle)" },
  { artist: "The Beatles", title: "Sgt. Pepper's Lonely Hearts Club Band", year: 1967, song: "A Day in the Life" },
  { artist: "Noah Kahan", title: "Stick Season", year: 2022, song: "Stick Season" },
  { artist: "The Beatles", title: "Revolver", year: 1966, song: "Eleanor Rigby" },
  { artist: "Flume", title: "Skin", year: 2016, song: "Never Be Like You" },
  { artist: "The Beatles", title: "The Beatles", year: 1968, song: "Blackbird" },
  { artist: "Phoebe Bridgers", title: "Punisher", year: 2020, song: "Kyoto" },
  { artist: "The Beatles", title: "Abbey Road", year: 1969, song: "Here Comes the Sun" },
  { artist: "Bon Iver", title: "Bon Iver, Bon Iver", year: 2011, song: "Holocene" },
  { artist: "The Beatles", title: "Rubber Soul", year: 1965, song: "In My Life" },
  { artist: "Bon Iver", title: "For Emma, Forever Ago", year: 2007, song: "Skinny Love" },
];
