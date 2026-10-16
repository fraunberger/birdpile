"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, List, Play, VolumeX } from "lucide-react";
import { ALBUMS, RETROSPECTIVE, type Album } from "@/lib/hundred-albums/albums";
import { albumAnchor, albumKey, albumNumber, jumpRanges, type Layout } from "@/lib/hundred-albums/list";
import { parseWriteup } from "@/lib/hundred-albums/writeup";
import { AlbumIndex } from "./AlbumIndex";
import { AlbumSection, Equalizer, Runs } from "./AlbumSection";
import { FadeImage } from "./Artwork";
import { serif, sans } from "./fonts";
import { useAlbumMedia } from "./media";
import { Soundtrack } from "./soundtrack";
import { onVideoPlaying, pauseVideos, playVideo } from "./youtube";
import styles from "./HundredAlbums.module.css";

const LAYOUT: Layout = {
  total: ALBUMS.length,
  countDown: RETROSPECTIVE.countDown,
  jumpSize: RETROSPECTIVE.jumpSize,
};

const soundtrack = new Soundtrack();

// The opening's background, blurred: the first few albums, repeated.
const MOSAIC = Array.from({ length: 36 }, (_, i) => ALBUMS[i % Math.min(6, ALBUMS.length)]);

function scrollToAlbum(index: number, behavior: ScrollBehavior) {
  document.getElementById(albumAnchor(index, LAYOUT))?.scrollIntoView({ behavior });
}

/** Keeps the address on the album showing (#no-87), so it can be shared or reloaded. */
function showInAddress(index: number | null) {
  const hash = index === null ? "" : `#${albumAnchor(index, LAYOUT)}`;
  if (hash !== window.location.hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  }
}

function Tile({ album }: { album: Album }) {
  const media = useAlbumMedia(album);
  return (
    <div>
      <FadeImage src={media.thumb} className={styles.thumb} />
    </div>
  );
}

/** 1–20, 21–40 and so on: plain links to each range's first album on the page. */
function JumpLinks() {
  if (LAYOUT.total <= LAYOUT.jumpSize) return null;
  return (
    <nav className={styles.jumps} aria-label="Jump to">
      <span className={styles.kicker}>Jump to</span>
      {jumpRanges(LAYOUT).map((range) => (
        <a key={range.first} href={`#${albumAnchor(range.index, LAYOUT)}`} className={styles.chip}>
          {range.label}
        </a>
      ))}
    </nav>
  );
}

function TopBar({
  current,
  muted,
  onToggleSound,
  onOpenIndex,
}: {
  current: number | null;
  muted: boolean;
  onToggleSound: () => void;
  onOpenIndex: () => void;
}) {
  const seen = current === null ? 0 : current + 1;
  return (
    <header className={styles.bar} style={{ "--progress": seen / LAYOUT.total } as React.CSSProperties}>
      <button type="button" className={styles.barTitle} onClick={() => window.scrollTo({ top: 0 })}>
        {RETROSPECTIVE.title} <em>{RETROSPECTIVE.titleSecondLine}</em>
      </button>
      {/* The number only: the name would give the guess away. */}
      <div className={styles.barNow} style={{ opacity: current === null ? 0 : 1 }}>
        {current !== null && (
          <>
            <b>No. {albumNumber(current, LAYOUT)}</b> &nbsp;of {LAYOUT.total}
          </>
        )}
      </div>
      <button
        type="button"
        className={styles.barButton}
        onClick={onToggleSound}
        aria-pressed={!muted}
        aria-label={muted ? "Turn the music on" : "Mute the music"}
      >
        {muted ? <VolumeX aria-hidden /> : <Equalizer playing />}
        <span>{muted ? "Sound off" : "Sound on"}</span>
      </button>
      <button
        type="button"
        className={styles.barButton}
        onClick={onOpenIndex}
        aria-haspopup="dialog"
        aria-label="Index of all the albums"
      >
        <List aria-hidden />
        <span className={styles.wideOnly}>Index</span>
      </button>
      <div className={styles.progress} aria-hidden />
    </header>
  );
}

function Opening({ onStart, onRead }: { onStart: () => void; onRead: () => void }) {
  const intro = parseWriteup(RETROSPECTIVE.intro);
  return (
    <>
      <header className={styles.hero} data-album="">
        <div className={styles.mosaic} aria-hidden>
          {MOSAIC.map((album, i) => (
            <Tile key={i} album={album} />
          ))}
        </div>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>{RETROSPECTIVE.kicker}</p>
          <h1 className={styles.heroTitle}>
            {RETROSPECTIVE.title} <em>{RETROSPECTIVE.titleSecondLine}</em>
          </h1>
          <p className={styles.dek}>{RETROSPECTIVE.dek}</p>
          <p className={styles.byline}>
            {RETROSPECTIVE.byline} <span>&middot; {RETROSPECTIVE.dateline}</span>
          </p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.primary} onClick={onStart}>
              <Play aria-hidden fill="currentColor" />
              Start with sound
            </button>
            <button type="button" className={styles.secondary} onClick={onRead}>
              Read in silence
            </button>
          </div>
          <JumpLinks />
          <p className={styles.heroNote}>Each album plays a song as you go. Mute it any time, top right.</p>
        </div>
        <ChevronDown className={styles.cue} aria-hidden />
      </header>
      {intro.length > 0 && (
        <div className={`${styles.intro} ${styles.prose}`} data-album="">
          {intro.map((runs, i) => (
            <p key={i}>
              <Runs runs={runs} />
            </p>
          ))}
        </div>
      )}
    </>
  );
}

function Ending() {
  return (
    <footer className={styles.pageEnd}>
      <div className={styles.fin}>
        <p className={styles.kicker}>That&rsquo;s the list</p>
        <p className={styles.finTitle}>Thanks for listening.</p>
        <button type="button" className={styles.secondary} onClick={() => window.scrollTo({ top: 0 })}>
          Back to the top
        </button>
      </div>
      <div>
        <Link href="/" className={styles.home}>
          birdpile
        </Link>
      </div>
    </footer>
  );
}

/**
 * The 100 Albums of My Life: one long countdown, each album a guess (its
 * lyric over the blurred cover) that resolves into the cover and a write-up,
 * while a preview of its song plays and then, given a YouTube link, the song.
 */
export function HundredAlbums() {
  const [current, setCurrent] = useState<number | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const currentRef = useRef<number | null>(null);
  // Whether the middle of the screen has been seen yet: until then the
  // address may hold a link being followed, and must be left alone.
  const located = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const muted = useSyncExternalStore(soundtrack.subscribe, soundtrack.isMuted, () => true);
  const currentMedia = useAlbumMedia(current === null ? null : ALBUMS[current]);
  const playing = !muted && current !== null && currentMedia.preview !== null;

  // Which album is in the middle of the screen.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          const value = (record.target as HTMLElement).dataset.album;
          located.current = true;
          setCurrent(value ? Number(value) : null);
        }
      },
      { rootMargin: "-49% 0px -50% 0px" },
    );
    main.querySelectorAll("[data-album]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  // Moving to another album: point the address at it, stop the last one's video.
  useEffect(() => {
    currentRef.current = current;
    if (located.current) showInAddress(current);
    pauseVideos();
  }, [current]);

  // The music follows the album on screen: its preview once, then its video.
  useEffect(() => {
    soundtrack.play(current === null ? null : currentMedia.preview);
  }, [current, currentMedia.preview]);

  useEffect(() => {
    soundtrack.setOnEnded(() => {
      if (currentRef.current !== null) playVideo(currentRef.current);
    });
    onVideoPlaying(() => soundtrack.yieldToVideo());
    return () => {
      soundtrack.setOnEnded(null);
      onVideoPlaying(null);
    };
  }, []);

  // A link to an album jumps there before the fonts arrive; once they do, the
  // write-ups above it change height a little, so jump again unless the
  // reader has already moved.
  useEffect(() => {
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (!target) return;
    let moved = false;
    const stop = () => {
      moved = true;
    };
    const events = ["wheel", "touchstart", "keydown", "mousedown"] as const;
    for (const name of events) window.addEventListener(name, stop, { passive: true });
    document.fonts?.ready.then(() => {
      if (!moved) target.scrollIntoView();
    });
    return () => {
      for (const name of events) window.removeEventListener(name, stop);
    };
  }, []);

  const toggleSound = useCallback(() => {
    if (soundtrack.isMuted()) {
      soundtrack.unmute();
      // The preview already played: carry on with the video, if there is one.
      if (soundtrack.isFinished() && currentRef.current !== null) playVideo(currentRef.current);
    } else {
      soundtrack.mute();
      pauseVideos();
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => soundtrack.setHidden(document.visibilityState === "hidden");
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]");
      if (event.key === "m" && !event.metaKey && !event.ctrlKey && !event.altKey && !typing) toggleSound();
    };
    const root = document.documentElement;
    const background = root.style.backgroundColor;
    root.style.backgroundColor = "#0c0c0c";
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      root.style.backgroundColor = background;
      soundtrack.stop();
      pauseVideos();
    };
  }, [toggleSound]);

  const closeIndex = useCallback(() => setIndexOpen(false), []);

  return (
    <div className={`${styles.page} ${serif.variable} ${sans.variable}`}>
      <TopBar
        current={current}
        muted={muted}
        onToggleSound={toggleSound}
        onOpenIndex={() => setIndexOpen(true)}
      />
      <main ref={mainRef}>
        <Opening
          onStart={() => {
            soundtrack.unmute();
            scrollToAlbum(0, "smooth");
          }}
          onRead={() => scrollToAlbum(0, "smooth")}
        />
        {ALBUMS.map((album, index) => (
          <AlbumSection
            key={`${index}-${albumKey(album)}`}
            album={album}
            index={index}
            number={albumNumber(index, LAYOUT)}
            playing={playing && current === index}
          />
        ))}
        <Ending />
      </main>
      {indexOpen && <AlbumIndex layout={LAYOUT} onClose={closeIndex} />}
    </div>
  );
}
