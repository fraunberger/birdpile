/* eslint-disable @next/next/no-img-element -- Apple's artwork CDN already serves the exact sizes asked for. */
"use client";

import { useEffect, useRef, useState } from "react";

function markLoaded(img: HTMLImageElement | null) {
  if (img?.complete && img.naturalWidth > 0) img.dataset.loaded = "";
}

/**
 * An image that fades in once it has loaded. Its `data-loaded` attribute is
 * set straight on the element, so a picture already in the cache shows at once.
 */
export function FadeImage({ src, className }: { src: string | null; className?: string }) {
  if (!src) return null;
  return (
    <img
      key={src}
      ref={markLoaded}
      src={src}
      alt=""
      decoding="async"
      className={className}
      onLoad={(event) => {
        event.currentTarget.dataset.loaded = "";
      }}
    />
  );
}

/** Whether the element is within `margin` of the screen right now. */
export function useInView<T extends Element>(margin: string) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (records) => setInView(records[records.length - 1].isIntersecting),
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [margin]);

  return [ref, inView] as const;
}
