/**
 * Drives each album's scroll animation. Every tracked section gets `--s`: how
 * many screen heights the page has scrolled since the section's top reached
 * the top of the screen (negative while it is still coming up from below).
 * The stylesheet turns that one number into the lyric fading in and out and
 * the cover blurring away, so all this does is keep it current.
 */

const tracked = new Map<HTMLElement, string>();
let frame = 0;

function update() {
  frame = 0;
  const screen = window.innerHeight || 1;
  // Read every position first, then write, so the browser lays out once.
  const values = [...tracked.keys()].map((section) => {
    const { top, height } = section.getBoundingClientRect();
    const s = Math.min(Math.max(-top / screen, -1.5), height / screen + 0.5);
    return [section, s.toFixed(4)] as const;
  });
  for (const [section, value] of values) {
    if (tracked.get(section) === value) continue;
    tracked.set(section, value);
    section.style.setProperty("--s", value);
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}

/** Keeps `--s` current on `section` until the returned function is called. */
export function trackScroll(section: HTMLElement): () => void {
  if (tracked.size === 0) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
  }
  tracked.set(section, "");
  schedule();
  return () => {
    tracked.delete(section);
    if (tracked.size === 0) {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
