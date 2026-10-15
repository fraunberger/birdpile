"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ALBUMS, type Album } from "@/lib/hundred-albums/albums";
import { albumNumber, pageBounds, pageCount, pageLabel, type Layout, type Target } from "@/lib/hundred-albums/list";
import { FadeImage, useNear } from "./Artwork";
import { useAlbumMedia } from "./media";
import styles from "./HundredAlbums.module.css";

function Entry({
  album,
  number,
  current,
  onSelect,
}: {
  album: Album;
  number: number;
  current: boolean;
  onSelect: () => void;
}) {
  const [ref, near] = useNear<HTMLButtonElement>();
  const media = useAlbumMedia(album, near);
  return (
    <li>
      <button
        ref={ref}
        type="button"
        className={styles.entry}
        aria-current={current}
        data-current={current || undefined}
        onClick={onSelect}
      >
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

/** The whole list, part by part, over the page. Choosing an album goes to it. */
export function AlbumIndex({
  layout,
  current,
  page,
  onGo,
  onClose,
}: {
  layout: Layout;
  /** The album on screen, if any. */
  current: number | null;
  page: number;
  onGo: (target: Target) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const parts = Array.from({ length: pageCount(layout) }, (_, part) => part);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    dialogRef.current
      ?.querySelector("[data-current]")
      ?.scrollIntoView({ block: "center" });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div ref={dialogRef} className={styles.index} role="dialog" aria-modal="true" aria-labelledby="album-index-title">
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
                <button type="button" className={styles.textButton} onClick={() => onGo({ kind: "part", page: part })}>
                  Read from the top
                </button>
              </div>
              <ol className={styles.entries}>
                {ALBUMS.slice(start, end).map((album, i) => (
                  <Entry
                    key={start + i}
                    album={album}
                    number={albumNumber(start + i, layout)}
                    current={current === start + i}
                    onSelect={() => onGo({ kind: "album", index: start + i })}
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
