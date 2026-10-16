"use client";

import { Fragment, useEffect, useRef } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { Album } from "@/lib/hundred-albums/albums";
import { songName } from "@/lib/hundred-albums/itunes";
import { youtubeVideo, type YouTubeVideo } from "@/lib/hundred-albums/list";
import { cleanLyric, parseWriteup, placeholderLyric, placeholderWriteup, type Inline } from "@/lib/hundred-albums/writeup";
import { FadeImage, useInView } from "./Artwork";
import { useAlbumMedia } from "./media";
import { trackScroll } from "./scroll";
import { attachPlayer } from "./youtube";
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
 * The full song on YouTube, in the write-up. The iframe exists while its
 * album is on or near the screen (`live`), so a long list doesn't load a
 * hundred players, yet it's ready by the time the preview ends.
 */
function FullSong({ video, index, live }: { video: YouTubeVideo; index: number; live: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (live && frameRef.current) return attachPlayer(index, frameRef.current);
  }, [live, index]);

  const params = new URLSearchParams({ enablejsapi: "1", playsinline: "1", rel: "0" });
  if (video.start) params.set("start", String(video.start));
  return (
    <div className={styles.fullSong}>
      <p className={styles.kicker}>The full song</p>
      <div className={styles.video}>
        {live && (
          <iframe
            ref={frameRef}
            src={`https://www.youtube.com/embed/${video.id}?${params}`}
            title="The full song on YouTube"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        )}
      </div>
    </div>
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
  // The album counts as wanted while within a screen and a half: that's when
  // it's looked up, so lookups keep pace with reading instead of all going to
  // Apple at once, and when its video player exists.
  const [ref, near] = useInView<HTMLElement>("150% 0px");
  const media = useAlbumMedia(album, near);
  const video = youtubeVideo(album.youtube);

  useEffect(() => {
    if (ref.current) return trackScroll(ref.current);
  }, [ref]);

  const lyric = cleanLyric(album.lyric ?? placeholderLyric());
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
            {video && <FullSong video={video} index={index} live={near} />}
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
