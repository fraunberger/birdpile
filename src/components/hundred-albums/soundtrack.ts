/**
 * The music behind the page: one audio element, faded between tracks as the
 * reader scrolls from album to album. Each track plays once; when it ends,
 * `onEnded` hears about it (the page then starts the full song on YouTube).
 *
 * Browsers only let a page start sound from a tap or click, so the reader
 * turns it on (`unmute`, called from the click itself). That first play
 * unlocks the element, and later tracks can start on their own. iOS ignores
 * volume changes, so there the fades are cuts.
 */

// 12 ms of silence (a WAV header, then zeros), played to unlock the element
// when there is no track yet to start with.
const SILENCE =
  "data:audio/wav;base64,UklGRugAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YcQAAAAA" + "A".repeat(260);

export class Soundtrack {
  private audio: HTMLAudioElement | null = null;
  private track: string | null = null;
  private muted = true;
  private hidden = false;
  private fadeFrame = 0;
  private switching = 0;
  /** The current track has played to its end, or a video took over from it. */
  private finished = false;
  private endedListener: (() => void) | null = null;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  isMuted = () => this.muted;

  isFinished = () => this.finished;

  setOnEnded(listener: (() => void) | null) {
    this.endedListener = listener;
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private element() {
    if (!this.audio) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.addEventListener("ended", () => {
        // Only the current track's end counts: one that runs out while fading
        // away from a switch belongs to the album just left.
        if (audio.src === SILENCE || audio.src !== this.track) return;
        this.finished = true;
        this.emit();
        if (!this.muted) this.endedListener?.();
      });
      this.audio = audio;
    }
    return this.audio;
  }

  private fade(to: number, ms: number, then?: () => void) {
    const audio = this.audio;
    cancelAnimationFrame(this.fadeFrame);
    if (!audio) return;
    const from = audio.volume;
    const start = performance.now();
    const step = (now: number) => {
      // A frame's timestamp can predate `start`; a negative t would push the
      // volume out of range, which throws.
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      audio.volume = from + (to - from) * t;
      if (t < 1) this.fadeFrame = requestAnimationFrame(step);
      else then?.();
    };
    this.fadeFrame = requestAnimationFrame(step);
  }

  private start(src: string) {
    const audio = this.element();
    const attempt = ++this.switching;
    if (audio.src !== src) audio.src = src;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        if (attempt === this.switching) this.fade(1, 900);
        else if (this.muted) audio.pause();
      })
      .catch((error: unknown) => {
        // Not allowed to play without a tap after all: show the sound as off.
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          this.muted = true;
          this.emit();
        }
      });
  }

  /** Turns the sound on. Call it straight from a click or tap handler. */
  unmute() {
    this.muted = false;
    if (this.track && !this.finished) {
      this.start(this.track);
    } else {
      const audio = this.element();
      audio.src = SILENCE;
      audio.play().catch(() => {});
    }
    this.emit();
  }

  mute() {
    this.muted = true;
    this.switching++;
    this.fade(0, 250, () => this.audio?.pause());
    this.emit();
  }

  /** The track for what's on screen now, or null for silence. */
  play(track: string | null) {
    // Compare full addresses: audio.src reports "/albums/x.mp3" as one.
    const src = track && new URL(track, window.location.href).href;
    if (src === this.track) return;
    this.track = src;
    if (this.finished) {
      this.finished = false;
      this.emit();
    }
    if (this.muted || this.hidden) return;
    // There may be no element yet when the sound came on from a tap on a video.
    const audio = this.element();
    const attempt = ++this.switching;
    const next = () => {
      if (attempt !== this.switching) return;
      if (src) this.start(src);
      else audio.pause();
    };
    if (!audio.paused && audio.volume > 0.01) this.fade(0, 400, next);
    else next();
  }

  /** Pauses while the tab is in the background. */
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) {
      this.switching++;
      cancelAnimationFrame(this.fadeFrame);
      this.audio?.pause();
    } else if (!this.muted && this.track && !this.finished) {
      this.start(this.track);
    }
  }

  /**
   * A video started playing: stop the preview for good, and count the sound
   * as on, since the reader chose to hear something.
   */
  yieldToVideo() {
    this.switching++;
    cancelAnimationFrame(this.fadeFrame);
    this.audio?.pause();
    this.finished = true;
    this.muted = false;
    this.emit();
  }

  /** Stops for good, when the reader leaves the page. */
  stop() {
    this.switching++;
    cancelAnimationFrame(this.fadeFrame);
    this.audio?.pause();
    this.audio?.removeAttribute("src");
    this.audio?.load();
    this.audio = null;
    this.track = null;
    this.finished = false;
    this.muted = true;
    this.emit();
  }
}
