/**
 * The music behind the page: one audio element, faded between tracks as the
 * reader scrolls from album to album.
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
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  isMuted = () => this.muted;

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private element() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.loop = true;
      this.audio.preload = "auto";
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
      const t = Math.min(1, (now - start) / ms);
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
    if (this.track) {
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
  play(src: string | null) {
    if (src === this.track) return;
    this.track = src;
    const audio = this.audio;
    if (this.muted || this.hidden || !audio) return;
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
    } else if (!this.muted && this.track) {
      this.start(this.track);
    }
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
    this.muted = true;
    this.emit();
  }
}
