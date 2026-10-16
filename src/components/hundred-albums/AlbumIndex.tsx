"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ALBUMS, type Album } from "@/lib/hundred-albums/albums";
import { albumNumber, pageBounds, pageCount, pageLabel, type Layout, type Target } from "@/lib/hundred-albums/list";
import { FadeImage, useNear } from "./Artwork";
import { useAlbumMedia } from "./media";
import styles from "./HundredAlbums.module.css";

function Entry({ album, number, onSelect }: { album: Album; number: number; onSelect: () => void }) {
  const [ref, near] = useNear<HTMLButtonElement>();
  const media = useAlbumMedia(album, near);
  return (
    <li>
      <button ref={ref} type="button" className={styles.entry} onClick={onSelect}>
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
      </button>
    </li>
  );
}

/**
 * The whole list, part by part, over the page. Choosing an album goes to it.
 * It opens at the current part without marking the album on screen, whose
 * name may still be a guess.
 */
export function AlbumIndex({
  layout,
  page,
  onGo,
  onClose,
}: {
  layout: Layout;
  page: number;
  onGo: (target: Target) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Focus goes back to the Index button only when closed without choosing:
  // after a jump, the space bar should scroll, not reopen the index.
  const restoreFocus = useRef(true);
  const parts = Array.from({ length: pageCount(layout) }, (_, part) => part);
  const go = (target: Target) => {
    restoreFocus.current = false;
    onGo(target);
  };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    if (page > 0) document.getElementById(`index-part-${page + 1}`)?.scrollIntoView();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (restoreFocus.current) previous?.focus({ preventScroll: true });
    };
  }, [onClose, page]);

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
          <nav className={styles.chips} aria-label="Parts">
            {parts.map((part) => (
              <button
                key={part}
                type="button"
                className={styles.chip}
                aria-current={part === page}
                onClick={() =>
                  document.getElementById(`index-part-${part + 1}`)?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Part {part + 1} &middot; {pageLabel(part, layout).replace("Nos. ", "")}
              </button>
            ))}
          </nav>
        </div>

        {parts.map((part) => {
          const [start, end] = pageBounds(part, layout);
          return (
            <section key={part} id={`index-part-${part + 1}`} className={styles.group}>
              <div className={styles.groupHead}>
                <h3 className={styles.groupTitle}>
                  <span>Part {part + 1}</span>
                  {pageLabel(part, layout)}
                </h3>
                <button type="button" className={styles.textButton} onClick={() => go({ kind: "part", page: part })}>
                  Read from the top
                </button>
              </div>
              <ol className={styles.entries}>
                {ALBUMS.slice(start, end).map((album, i) => (
                  <Entry
                    key={start + i}
                    album={album}
                    number={albumNumber(start + i, layout)}
                    onSelect={() => go({ kind: "album", index: start + i })}
                  />
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
