/**
 * The full songs: YouTube players in the write-ups, at most one playing.
 *
 * The page renders each video's iframe itself, so it can always be played by
 * hand; YouTube's player API attaches to it to start it after the preview
 * ends and to pause it when the reader moves on. Phones ignore a start that
 * doesn't come from a tap on the video, so there it just waits.
 */

type Player = {
  playVideo(): void;
  pauseVideo(): void;
};

type PlayerApi = {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { onStateChange: (event: { data: number }) => void } },
  ) => Player;
  PlayerState: { PLAYING: number };
};

declare global {
  interface Window {
    YT?: PlayerApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let api: Promise<PlayerApi> | null = null;

function loadApi(): Promise<PlayerApi> {
  api ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return api;
}

const players = new Map<number, Player>();
let playingListener: ((index: number) => void) | null = null;

/** Hooks the iframe of album `index` up to the player API. Returns the unhook. */
export function attachPlayer(index: number, frame: HTMLIFrameElement): () => void {
  let attached: Player | null = null;
  let cancelled = false;
  loadApi().then((YT) => {
    if (cancelled) return;
    attached = new YT.Player(frame, {
      events: {
        onStateChange: ({ data }) => {
          if (data !== YT.PlayerState.PLAYING) return;
          pauseVideos(index);
          playingListener?.(index);
        },
      },
    });
    players.set(index, attached);
  });
  return () => {
    cancelled = true;
    if (attached && players.get(index) === attached) players.delete(index);
  };
}

// A player whose iframe is still loading, or already gone, can throw.
function tell(player: Player | undefined, command: "playVideo" | "pauseVideo") {
  try {
    player?.[command]();
  } catch {
    // Nothing to start or stop.
  }
}

/** Starts album `index`'s video, if it has one ready. */
export function playVideo(index: number) {
  tell(players.get(index), "playVideo");
}

/** Pauses every video, or every one but album `except`'s. */
export function pauseVideos(except?: number) {
  for (const [index, player] of players) {
    if (index !== except) tell(player, "pauseVideo");
  }
}

/** Hears when a video starts playing, whether started by the page or a tap. */
export function onVideoPlaying(listener: ((index: number) => void) | null) {
  playingListener = listener;
}
