"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ALBUMS, type Album } from "@/lib/hundred-albums/albums";
import { albumAnchor, albumNumber, jumpRanges, type Layout } from "@/lib/hundred-albums/list";
import { FadeImage } from "./Artwork";
import { useAlbumMedia } from "./media";
import styles from "./HundredAlbums.module.css";

function Entry({ album, number, anchor, onSelect }: { album: Album; number: number; anchor: string; onSelect: () => void }) {
  // Covers this browser already has only: scrolling the index shouldn't send
  // a hundred lookups to Apple.
  const media = useAlbumMedia(album, false);
  return (
    <li id={`index-${anchor}`}>
      <a href={`#${anchor}`} className={styles.entry} onClick={onSelect}>
        <span className={styles.entryNumber}>{number}</span>
        <span className={styles.entryThumb}>
          <FadeImage src={media.thumb} className={styles.thumb} />
        </span>
        <span className={styles.entryText}>
          <span className={styles.entryTitle}>{album.title}</span>
          <span className={styles.entryMeta}>
            {album.artist} &middot; {album.year}
          </span>
        </span>
      </a>
    </li>
  );
}

/**
 * Every album in one list over the page, in page order, with shortcuts to
 * 1–20, 21–40 and so on at the top. Choosing an album goes to it. Nothing
 * marks the album on screen, whose name may still be a guess.
 */
export function AlbumIndex({ layout, onClose }: { layout: Layout; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Focus goes back to the Index button only when closed without choosing:
  // after a jump, the space bar should scroll, not reopen the index.
  const restoreFocus = useRef(true);
  const choose = () => {
    restoreFocus.current = false;
    onClose();
  };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (restoreFocus.current) previous?.focus({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div className={styles.index} role="dialog" aria-modal="true" aria-labelledby="album-index-title">
      <div className={styles.indexInner}>
        <div className={styles.indexHead}>
          <div className={styles.indexTop}>
            <h2 id="album-index-title" className={styles.indexTitle}>
              The <em>list</em>
            </h2>
            <button ref={closeRef} type="button" className={styles.barButton} onClick={onClose}>
              <X aria-hidden />
              <span>Close</span>
            </button>
          </div>
          {layout.total > layout.jumpSize && (
            <nav className={styles.chips} aria-label="Jump to">
              {jumpRanges(layout).map((range) => (
                <button
                  key={range.first}
                  type="button"
                  className={styles.chip}
                  onClick={() =>
                    document
                      .getElementById(`index-${albumAnchor(range.index, layout)}`)
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  {range.label}
                </button>
              ))}
            </nav>
          )}
        </div>
        <ol className={styles.entries}>
          {ALBUMS.map((album, index) => (
            <Entry
              key={index}
              album={album}
              number={albumNumber(index, layout)}
              anchor={albumAnchor(index, layout)}
              onSelect={choose}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
