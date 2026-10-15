"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown, List, Play, VolumeX } from "lucide-react";
import { ALBUMS, RETROSPECTIVE, type Album } from "@/lib/hundred-albums/albums";
import {
  albumKey,
  albumNumber,
  hashFor,
  pageBounds,
  pageCount,
  pageLabel,
  pageOf,
  parseHash,
  targetPage,
  type Layout,
  type Target,
} from "@/lib/hundred-albums/list";
import { parseWriteup } from "@/lib/hundred-albums/writeup";
import { AlbumIndex } from "./AlbumIndex";
import { AlbumSection, Equalizer, Runs } from "./AlbumSection";
import { FadeImage, useNear } from "./Artwork";
import { serif, sans } from "./fonts";
import { useAlbumMedia } from "./media";
import { Soundtrack } from "./soundtrack";
import styles from "./HundredAlbums.module.css";

const LAYOUT: Layout = {
  total: ALBUMS.length,
  pageSize: RETROSPECTIVE.pageSize,
  countDown: RETROSPECTIVE.countDown,
};

const soundtrack = new Soundtrack();

// The address's #fragment says which part is showing (#part-3), or which
// album (#no-87). It changes as the reader scrolls, so links can be shared.
const hashListeners = new Set<() => void>();

function subscribeHash(listener: () => void) {
  hashListeners.add(listener);
  window.addEventListener("popstate", listener);
  window.addEventListener("hashchange", listener);
  return () => {
    hashListeners.delete(listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener("hashchange", listener);
  };
}

function writeHash(hash: string, mode: "push" | "replace") {
  if (hash === window.location.hash) return;
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  for (const listener of hashListeners) listener();
}

function Tile({ album, load }: { album: Album; load: boolean }) {
  const media = useAlbumMedia(album, load);
  return (
    <div>
      <FadeImage src={media.thumb} className={styles.thumb} />
    </div>
  );
}

function TopBar({
  current,
  page,
  muted,
  onToggleSound,
  onOpenIndex,
  onHome,
}: {
  current: number | null;
  page: number;
  muted: boolean;
  onToggleSound: () => void;
  onOpenIndex: () => void;
  onHome: () => void;
}) {
  const seen = current === null ? pageBounds(page, LAYOUT)[0] : current + 1;
  return (
    <header className={styles.bar} style={{ "--progress": seen / LAYOUT.total } as React.CSSProperties}>
      <button type="button" className={styles.barTitle} onClick={onHome}>
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
  const [start, end] = pageBounds(0, LAYOUT);
  const firstPart = ALBUMS.slice(start, end);
  const tiles = Array.from({ length: 36 }, (_, i) => firstPart[i % firstPart.length]);
  const intro = parseWriteup(RETROSPECTIVE.intro);
  return (
    <>
      <header className={styles.hero} data-album="">
        <div className={styles.mosaic} aria-hidden>
          {tiles.map((album, i) => (
            <Tile key={i} album={album} load />
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

function PartOpening({ page, onGo }: { page: number; onGo: (target: Target) => void }) {
  return (
    <header className={styles.partHead} data-album="">
      <div>
        <p className={styles.kicker}>
          Part {page + 1} of {pageCount(LAYOUT)}
        </p>
        <h1 className={styles.partTitle}>{pageLabel(page, LAYOUT)}</h1>
        <button type="button" className={styles.textButton} onClick={() => onGo({ kind: "part", page: page - 1 })}>
          <ArrowLeft aria-hidden />
          Back to part {page}
        </button>
      </div>
    </header>
  );
}

function PartEnd({ page, onGo }: { page: number; onGo: (target: Target, smooth?: boolean) => void }) {
  const parts = pageCount(LAYOUT);
  const next = page + 1 < parts ? page + 1 : null;
  const [ref, near] = useNear<HTMLElement>("600px");
  const [start, end] = next === null ? [0, 0] : pageBounds(next, LAYOUT);
  return (
    <footer ref={ref} className={styles.pageEnd}>
      {next !== null ? (
        <button type="button" className={styles.nextCard} onClick={() => onGo({ kind: "part", page: next })}>
          <span className={styles.kicker}>Up next &middot; Part {next + 1}</span>
          <span className={styles.nextTitle}>{pageLabel(next, LAYOUT)}</span>
          <span className={styles.stack} aria-hidden>
            {ALBUMS.slice(start, Math.min(end, start + 5)).map((album, i) => (
              <Tile key={i} album={album} load={near} />
            ))}
          </span>
          <span className={styles.nextGo}>
            Keep going
            <ArrowRight aria-hidden />
          </span>
        </button>
      ) : (
        <div className={styles.fin}>
          <p className={styles.kicker}>That&rsquo;s the list</p>
          <p className={styles.nextTitle}>Thanks for listening.</p>
          <button type="button" className={styles.secondary} onClick={() => onGo({ kind: "part", page: 0 }, page === 0)}>
            Back to the beginning
          </button>
        </div>
      )}
      {parts > 1 && (
        <nav className={styles.pager} aria-label="Parts">
          <p className={`${styles.kicker} ${styles.pagerLabel}`}>All parts</p>
          {Array.from({ length: parts }, (_, part) => (
            <button
              key={part}
              type="button"
              className={styles.pagerButton}
              aria-current={part === page ? "page" : undefined}
              title={pageLabel(part, LAYOUT)}
              onClick={() => onGo({ kind: "part", page: part })}
            >
              {part + 1}
            </button>
          ))}
        </nav>
      )}
      <div>
        <Link href="/" className={styles.home}>
          birdpile
        </Link>
      </div>
    </footer>
  );
}

/**
 * The 100 Albums of My Life: a scrolling countdown in parts, each album's
 * cover and lyric giving way to a write-up while a preview of its song plays.
 */
export function HundredAlbums() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const page = targetPage(parseHash(hash, LAYOUT), LAYOUT);
  const [active, setActive] = useState<number | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [navigations, setNavigations] = useState(0);
  const pending = useRef<{ target: Target; smooth: boolean } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const muted = useSyncExternalStore(soundtrack.subscribe, soundtrack.isMuted, () => true);

  // The album in the middle of the screen, once it's one on this part.
  const current = active !== null && pageOf(active, LAYOUT) === page ? active : null;
  const currentMedia = useAlbumMedia(current === null ? null : ALBUMS[current]);
  const playing = !muted && current !== null && currentMedia.preview !== null;

  const goTo = useCallback((target: Target, smooth = false) => {
    setIndexOpen(false);
    pending.current = { target, smooth };
    writeHash(hashFor(target, LAYOUT), "push");
    setNavigations((count) => count + 1);
  }, []);

  // Arriving on a link to an album or a part, or going back and forward
  // through history, scrolls to it once its part is showing.
  useLayoutEffect(() => {
    window.history.scrollRestoration = "manual";
    const target = parseHash(window.location.hash, LAYOUT);
    if (target.kind === "album" || target.page > 0) pending.current = { target, smooth: false };
    const onHistory = () => {
      pending.current = { target: parseHash(window.location.hash, LAYOUT), smooth: false };
      setNavigations((count) => count + 1);
    };
    window.addEventListener("popstate", onHistory);
    window.addEventListener("hashchange", onHistory);
    return () => {
      window.removeEventListener("popstate", onHistory);
      window.removeEventListener("hashchange", onHistory);
      window.history.scrollRestoration = "auto";
    };
  }, []);

  useLayoutEffect(() => {
    const next = pending.current;
    if (!next || targetPage(next.target, LAYOUT) !== page) return;
    pending.current = null;
    const section = next.target.kind === "album" ? document.getElementById(`no-${albumNumber(next.target.index, LAYOUT)}`) : null;
    const top = section ? section.getBoundingClientRect().top + window.scrollY : 0;
    window.scrollTo({ top, behavior: next.smooth ? "smooth" : "instant" });
  }, [page, navigations]);

  // Which album is in the middle of the screen.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (!record.isIntersecting) continue;
          const value = (record.target as HTMLElement).dataset.album;
          setActive(value ? Number(value) : null);
        }
      },
      { rootMargin: "-49% 0px -50% 0px" },
    );
    main.querySelectorAll("[data-album]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [page]);

  // Keep the address on what's showing, so it can be shared or reloaded.
  useEffect(() => {
    if (pending.current) return;
    const target: Target = current === null ? { kind: "part", page } : { kind: "album", index: current };
    writeHash(hashFor(target, LAYOUT), "replace");
  }, [current, page]);

  // The music follows the album on screen.
  useEffect(() => {
    soundtrack.play(current === null ? null : currentMedia.preview);
  }, [current, currentMedia.preview]);

  useEffect(() => {
    const onVisibility = () => soundtrack.setHidden(document.visibilityState === "hidden");
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]");
      if (event.key === "m" && !event.metaKey && !event.ctrlKey && !event.altKey && !typing) {
        if (soundtrack.isMuted()) soundtrack.unmute();
        else soundtrack.mute();
      }
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
    };
  }, []);

  const toggleSound = useCallback(() => {
    if (soundtrack.isMuted()) soundtrack.unmute();
    else soundtrack.mute();
  }, []);
  const closeIndex = useCallback(() => setIndexOpen(false), []);
  const firstAlbum: Target = { kind: "album", index: pageBounds(0, LAYOUT)[0] };
  const [start, end] = pageBounds(page, LAYOUT);

  return (
    <div className={`${styles.page} ${serif.variable} ${sans.variable}`}>
      <TopBar
        current={current}
        page={page}
        muted={muted}
        onToggleSound={toggleSound}
        onOpenIndex={() => setIndexOpen(true)}
        onHome={() => goTo({ kind: "part", page: 0 }, page === 0)}
      />
      <main ref={mainRef}>
        {page === 0 ? (
          <Opening
            onStart={() => {
              soundtrack.unmute();
              goTo(firstAlbum, true);
            }}
            onRead={() => goTo(firstAlbum, true)}
          />
        ) : (
          <PartOpening page={page} onGo={goTo} />
        )}
        {ALBUMS.slice(start, end).map((album, i) => (
          <AlbumSection
            key={`${start + i}-${albumKey(album)}`}
            album={album}
            index={start + i}
            number={albumNumber(start + i, LAYOUT)}
            playing={playing && current === start + i}
          />
        ))}
        <PartEnd page={page} onGo={goTo} />
      </main>
      {indexOpen && (
        <AlbumIndex layout={LAYOUT} current={current} page={page} onGo={goTo} onClose={closeIndex} />
      )}
    </div>
  );
}
