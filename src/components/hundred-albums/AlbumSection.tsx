"use client";

import { Fragment, useEffect, useRef } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { Album } from "@/lib/hundred-albums/albums";
import { songName } from "@/lib/hundred-albums/itunes";
import { parseWriteup, placeholderLyric, placeholderWriteup, type Inline } from "@/lib/hundred-albums/writeup";
import { FadeImage } from "./Artwork";
import { useAlbumMedia } from "./media";
import { trackScroll } from "./scroll";
import styles from "./HundredAlbums.module.css";

export function Runs({ runs }: { runs: Inline[] }) {
  return runs.map((run, i) => {
    if (run.kind === "em") return <em key={i}>{run.text}</em>;
    if (run.kind === "strong") return <strong key={i}>{run.text}</strong>;
    if (run.kind === "link") {
      return (
        <a key={i} href={run.href} target="_blank" rel="noopener noreferrer">
          {run.text}
        </a>
      );
    }
    return <Fragment key={i}>{run.text}</Fragment>;
  });
}

export function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className={`${styles.eq} ${playing ? "" : styles.eqPaused}`} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * One album, as a guessing game: the lyric over the cover blurred past
 * recognizing, then the cover comes into focus with its name, and the
 * write-up scrolls up over it in a frosted box.
 */
export function AlbumSection({
  album,
  index,
  number,
  playing,
}: {
  album: Album;
  index: number;
  number: number;
  /** Whether this album's song is the one playing. */
  playing: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const media = useAlbumMedia(album);

  useEffect(() => {
    if (ref.current) return trackScroll(ref.current);
  }, []);

  const lyric = album.lyric ?? placeholderLyric();
  const lyricSize = lyric.length < 50 ? styles.lyricShort : lyric.length > 120 ? styles.lyricLong : "";
  const paragraphs = parseWriteup(album.writeup ?? placeholderWriteup(album));
  // Say so when the song wasn't found and another from the album plays instead.
  const songTitle =
    media.previewTitle && songName(media.previewTitle) !== songName(album.song) ? media.previewTitle : album.song;

  return (
    // Labelled by number only, so a screen reader doesn't give the answer away.
    <section ref={ref} id={`no-${number}`} data-album={index} className={styles.album} aria-label={`No. ${number}`}>
      <div className={styles.stage}>
        <FadeImage src={media.thumb} className={styles.ambient} />
        <div className={styles.shade} />
        <figure className={styles.figure}>
          <div className={styles.coverFrame}>
            <div className={styles.cover}>
              <div className={styles.coverStandIn} aria-hidden>
                <strong>{album.title}</strong>
                <span>{album.artist}</span>
              </div>
              <FadeImage src={media.cover} className={styles.coverImg} />
            </div>
            <div className={styles.lyricShade} />
            <blockquote className={`${styles.lyric} ${lyricSize}`}>
              <span className={styles.lyricRank}>No. {number}</span>
              <p>{`“${lyric}”`}</p>
              <span className={styles.guess}>
                Name the album
                <ArrowDown aria-hidden />
              </span>
            </blockquote>
          </div>
          <figcaption className={styles.caption}>
            <span className={styles.captionRank}>No. {number}</span>
            <span className={styles.captionTitle}>
              {album.artist}, <i>{album.title}</i> ({album.year})
            </span>
          </figcaption>
        </figure>
      </div>

      <div className={styles.flow}>
        <div className={styles.runway} />
        <div className={styles.writeup}>
          <article className={styles.box}>
            <header className={styles.writeupHead}>
              <p className={styles.kicker}>No. {number}</p>
              <h2 className={styles.writeupTitle}>{album.title}</h2>
              <p className={styles.writeupMeta}>
                <b>{album.artist}</b> &middot; {album.year}
              </p>
            </header>
            <div className={styles.prose}>
              {paragraphs.map((runs, i) => (
                <p key={i}>
                  <Runs runs={runs} />
                </p>
              ))}
            </div>
            <footer className={styles.writeupFoot}>
              <span className={styles.nowPlaying}>
                <Equalizer playing={playing} />
                {playing ? "Now playing" : "The song"}: &ldquo;{songTitle}&rdquo;
              </span>
              {media.appleUrl && (
                <a href={media.appleUrl} target="_blank" rel="noopener noreferrer">
                  Listen on Apple Music
                  <ArrowUpRight aria-hidden />
                </a>
              )}
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}
