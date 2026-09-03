"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, SkipForward, Volume2, VolumeX } from "lucide-react";

// --- Types ---

type Motion = "nod" | "shake" | "ears" | "arc" | "chicken" | "slide";

type Stretch = {
    name: string;
    cue: string;
    motion: Motion;
};

type Phase = "idle" | "stretch" | "done";

// --- Constants ---

const STRETCH_SECONDS = 30;

const STRETCHES: Stretch[] = [
    {
        name: "Nod up and down",
        cue: "Chin to sky, chin to chest. Slow.",
        motion: "nod",
    },
    {
        name: "Shake side to side",
        cue: "Turn to look over one shoulder, then the other.",
        motion: "shake",
    },
    {
        name: "Alternating ears up",
        cue: "Tip one ear toward the sky, then the other.",
        motion: "ears",
    },
    {
        name: "Bottom half of a circle",
        cue: "Sweep your chin low across your chest, shoulder to shoulder.",
        motion: "arc",
    },
    {
        name: "Chicken out to many chins in",
        cue: "Push the chin forward, then tuck it back. Own the double chin.",
        motion: "chicken",
    },
    {
        name: "Janet Jackson side to side",
        cue: "Slide the head sideways, eyes level, shoulders still.",
        motion: "slide",
    },
];

// Side-on moves read as nothing at all from the front, so the bird turns to
// profile for those and faces you for the lateral ones.
const PROFILE_MOTIONS: ReadonlySet<Motion> = new Set<Motion>(["nod", "chicken"]);

// Where each move hinges. Nodding and turning happen up at the base of the
// skull; tilting and the low sweep bend the whole neck from the shoulders.
const SKULL_BASE = "100px 86px";
const NECK_BASE = "100px 114px";
const MOTION_PIVOT: Record<Motion, string> = {
    nod: SKULL_BASE,
    shake: SKULL_BASE,
    ears: NECK_BASE,
    arc: NECK_BASE,
    chicken: NECK_BASE,
    slide: NECK_BASE,
};

// --- Helpers ---

function formatSeconds(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return String(total);
}

function useBeep(enabled: boolean) {
    const ctxRef = useRef<AudioContext | null>(null);

    return useCallback(
        (times: number) => {
            if (!enabled) return;
            try {
                type WindowWithLegacyAudio = Window & {
                    webkitAudioContext?: typeof AudioContext;
                };
                const AudioCtor =
                    window.AudioContext ??
                    (window as WindowWithLegacyAudio).webkitAudioContext;
                if (!AudioCtor) return;
                if (!ctxRef.current) ctxRef.current = new AudioCtor();
                const ctx = ctxRef.current;
                void ctx.resume();
                for (let i = 0; i < times; i++) {
                    const start = ctx.currentTime + i * 0.22;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.value = i === times - 1 ? 660 : 520;
                    gain.gain.setValueAtTime(0.0001, start);
                    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(start);
                    osc.stop(start + 0.2);
                }
            } catch {
                // Audio is a nicety; never let it break the timer.
            }
        },
        [enabled]
    );
}

// --- Component ---

export function NeckStretch() {
    const [phase, setPhase] = useState<Phase>("idle");
    const [index, setIndex] = useState(0);
    const [remaining, setRemaining] = useState(STRETCH_SECONDS * 1000);
    const [running, setRunning] = useState(false);
    const [soundOn, setSoundOn] = useState(true);

    const deadlineRef = useRef<number>(0);
    const beep = useBeep(soundOn);

    const current = STRETCHES[index];
    const isLast = index === STRETCHES.length - 1;

    // Keep the screen awake while a session is running, where supported.
    useEffect(() => {
        if (!running) return;
        type Sentinel = { release: () => Promise<void> };
        const nav = navigator as unknown as {
            wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
        };
        const wakeLock = nav.wakeLock;
        if (!wakeLock) return;
        // Resolves whether or not the lock was granted; the cleanup chains off
        // it so a lock that arrives after unmount is still released.
        const pending: Promise<Sentinel | null> = wakeLock
            .request("screen")
            .catch(() => null);
        return () => {
            void pending.then((lock) => lock?.release()).catch(() => {});
        };
    }, [running]);

    // The clock. Deadline based so a backgrounded tab doesn't drift.
    useEffect(() => {
        if (!running || phase !== "stretch") return;

        deadlineRef.current = performance.now() + remaining;

        const tick = () => {
            const left = deadlineRef.current - performance.now();
            if (left > 0) {
                setRemaining(left);
                return;
            }

            if (index === STRETCHES.length - 1) {
                beep(3);
                setRunning(false);
                setPhase("done");
                setRemaining(0);
            } else {
                // Straight into the next one — no gap, no preview.
                beep(2);
                setIndex((i) => i + 1);
                setRemaining(STRETCH_SECONDS * 1000);
            }
        };

        const id = window.setInterval(tick, 100);
        return () => window.clearInterval(id);
        // `remaining` is intentionally excluded: it is re-read via the deadline
        // on every (re)start, and including it would reset the interval 10x/sec.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, phase, index, beep]);

    const start = () => {
        beep(2);
        setIndex(0);
        setPhase("stretch");
        setRemaining(STRETCH_SECONDS * 1000);
        setRunning(true);
    };

    const reset = () => {
        setRunning(false);
        setPhase("idle");
        setIndex(0);
        setRemaining(STRETCH_SECONDS * 1000);
    };

    const skip = () => {
        if (isLast) {
            setRunning(false);
            setPhase("done");
            setRemaining(0);
            return;
        }
        setIndex((i) => i + 1);
        setRemaining(STRETCH_SECONDS * 1000);
    };

    const active = phase === "stretch";
    const progress = active
        ? 1 - Math.min(1, Math.max(0, remaining / (STRETCH_SECONDS * 1000)))
        : 0;

    return (
        <div className="w-full max-w-md mx-auto font-mono text-black">
            <style>{ANIMATION_CSS}</style>

            <h1 className="text-2xl font-bold tracking-tight">Neck Stretch</h1>
            <p className="text-sm text-gray-500 mt-1">
                Six moves, {STRETCH_SECONDS} seconds each. Slow cadence — whatever feels good.
            </p>

            <div className="mt-6 border border-black">
                <div className="p-6 flex flex-col items-center">
                    <BirdHead motion={active ? current.motion : null} paused={!running} />

                    <Ring progress={progress}>
                        {phase === "idle" && (
                            <span className="text-4xl font-bold">{STRETCH_SECONDS}</span>
                        )}
                        {phase === "done" && <span className="text-3xl font-bold">done</span>}
                        {active && (
                            <span className="text-5xl font-bold tabular-nums">
                                {formatSeconds(remaining)}
                            </span>
                        )}
                    </Ring>

                    <div className="mt-5 text-center min-h-[76px]">
                        {phase === "idle" && (
                            <>
                                <p className="text-lg font-bold">Ready when you are</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Sit tall, shoulders down, breathe.
                                </p>
                            </>
                        )}
                        {active && (
                            <>
                                <p className="text-xs uppercase tracking-widest text-gray-500">
                                    {index + 1} of {STRETCHES.length}
                                </p>
                                <p className="text-lg font-bold mt-1">{current.name}</p>
                                <p className="text-sm text-gray-500 mt-1">{current.cue}</p>
                            </>
                        )}
                        {phase === "done" && (
                            <>
                                <p className="text-lg font-bold">Neck stretched.</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Go be a swan about it.
                                </p>
                            </>
                        )}
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                        {phase === "idle" && (
                            <button
                                onClick={start}
                                className="flex items-center gap-2 bg-black text-white px-8 py-3 text-sm uppercase tracking-widest hover:opacity-80 transition-opacity"
                            >
                                <Play size={16} /> Start
                            </button>
                        )}

                        {active && (
                            <>
                                <button
                                    onClick={() => setRunning((r) => !r)}
                                    className="flex items-center gap-2 bg-black text-white px-6 py-3 text-sm uppercase tracking-widest hover:opacity-80 transition-opacity"
                                >
                                    {running ? <Pause size={16} /> : <Play size={16} />}
                                    {running ? "Pause" : "Resume"}
                                </button>
                                <button
                                    onClick={skip}
                                    aria-label="Skip to next stretch"
                                    className="flex items-center gap-2 border border-black px-4 py-3 text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                                >
                                    <SkipForward size={16} />
                                </button>
                            </>
                        )}

                        {phase === "done" && (
                            <button
                                onClick={start}
                                className="flex items-center gap-2 bg-black text-white px-8 py-3 text-sm uppercase tracking-widest hover:opacity-80 transition-opacity"
                            >
                                <RotateCcw size={16} /> Again
                            </button>
                        )}

                        {phase !== "idle" && (
                            <button
                                onClick={reset}
                                aria-label="Reset"
                                className="flex items-center gap-2 border border-black px-4 py-3 text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                            >
                                <RotateCcw size={16} />
                            </button>
                        )}

                        <button
                            onClick={() => setSoundOn((s) => !s)}
                            aria-label={soundOn ? "Mute cues" : "Unmute cues"}
                            className="p-3 text-gray-500 hover:text-black transition-colors"
                        >
                            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                    </div>
                </div>

                <ol className="border-t border-black divide-y divide-gray-200">
                    {STRETCHES.map((stretch, i) => {
                        const isCurrent = active && i === index;
                        const isDone = phase === "done" || i < index;
                        return (
                            <li
                                key={stretch.name}
                                className={`flex items-center gap-3 px-4 py-2 text-sm ${
                                    isCurrent ? "bg-black text-white" : ""
                                } ${isDone ? "text-gray-400" : ""}`}
                            >
                                <span className="w-4 text-xs tabular-nums opacity-60">{i + 1}</span>
                                <span className={isDone ? "line-through" : ""}>{stretch.name}</span>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}

// --- Pieces ---

function Ring({ progress, children }: { progress: number; children: React.ReactNode }) {
    const size = 180;
    const stroke = 6;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="relative mt-6" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#000"
                    strokeWidth={stroke}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progress)}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">{children}</div>
        </div>
    );
}

function BirdHead({ motion, paused }: { motion: Motion | null; paused: boolean }) {
    const profile = motion !== null && PROFILE_MOTIONS.has(motion);
    const playState = paused ? ("paused" as const) : ("running" as const);
    const pivot = motion ? MOTION_PIVOT[motion] : NECK_BASE;
    // Nodding and turning happen on top of a neck that stays where it is;
    // everything else carries the neck along with the head.
    const neckMoves = motion !== "nod" && motion !== "shake";
    const neck = (
        <path d="M100 116 L100 82" stroke="#000" strokeWidth={9} strokeLinecap="round" />
    );

    return (
        <svg width={200} height={140} viewBox="0 0 200 140" aria-hidden="true">
            {/* Shoulders stay put. Only the head moves. */}
            <path
                d={profile ? "M50 134 Q100 110 150 134" : "M40 134 Q100 108 160 134"}
                fill="none"
                stroke="#000"
                strokeWidth={3}
                strokeLinecap="round"
            />


            {!neckMoves && neck}

            <g
                className={motion ? `ns-${motion}` : undefined}
                style={{ transformOrigin: pivot, animationPlayState: playState }}
            >
                {neckMoves && neck}

                {/* Narrows as the bird turns away from you, without squashing
                    the eyes — they live outside this group. */}
                <g
                    className={motion === "shake" ? "ns-shake-head" : undefined}
                    style={{ transformOrigin: "100px 58px", animationPlayState: playState }}
                >
                    <circle cx={100} cy={58} r={27} fill="#fff" stroke="#000" strokeWidth={3} />
                </g>

                {profile ? (
                    <>
                        {/* Facing right: one eye, beak off the front of the head. */}
                        <circle cx={111} cy={52} r={3.4} fill="#000" />
                        <path
                            d="M124 54 L150 60 L124 66 Z"
                            fill="#f59e0b"
                            stroke="#000"
                            strokeWidth={2}
                            strokeLinejoin="round"
                        />
                    </>
                ) : (
                    // Facing you: the features slide within the head when the
                    // bird turns, which is what selling a "no" shake takes.
                    <g
                        className={motion === "shake" ? "ns-shake-face" : undefined}
                        style={{ transformOrigin: pivot, animationPlayState: playState }}
                    >
                        <circle cx={89} cy={53} r={3.4} fill="#000" />
                        <circle cx={111} cy={53} r={3.4} fill="#000" />
                        <path
                            d="M100 62 L92 74 L108 74 Z"
                            fill="#f59e0b"
                            stroke="#000"
                            strokeWidth={2}
                            strokeLinejoin="round"
                        />
                    </g>
                )}
            </g>
        </svg>
    );
}

// Slow, loop-forever pacers — one per motion, each pivoting at the neck base.
// Roughly a five-second cycle, about as fast as any of these should be done.
const ANIMATION_CSS = `
/* Profile: beak swings up to the sky, chin drops to the chest. */
@keyframes ns-nod {
  0%, 100% { transform: rotate(-20deg); }
  50%      { transform: rotate(22deg); }
}
/* Front: the head turns — features swing across, the face narrows. */
@keyframes ns-shake {
  0%, 100% { transform: rotate(-5deg) translateX(-8px); }
  25%, 75% { transform: rotate(0deg) translateX(0px); }
  50%      { transform: rotate(5deg) translateX(8px); }
}
@keyframes ns-shake-head {
  0%, 100% { transform: scaleX(0.86); }
  25%, 75% { transform: scaleX(1); }
  50%      { transform: scaleX(0.86); }
}
@keyframes ns-shake-face {
  0%, 100% { transform: translateX(-8px); }
  50%      { transform: translateX(8px); }
}
/* Front: ear to the sky, then the other one. */
@keyframes ns-ears {
  0%, 100% { transform: rotate(-24deg); }
  50%      { transform: rotate(24deg); }
}
/* Front: chin sweeps the low arc, shoulder to shoulder and back. */
@keyframes ns-arc {
  0%, 100% { transform: rotate(-28deg) translateY(0px); }
  25%      { transform: rotate(-15deg) translateY(4px); }
  50%      { transform: rotate(0deg) translateY(7px); }
  75%      { transform: rotate(15deg) translateY(4px); }
}
/* Profile: chin juts forward, then tucks straight back. */
@keyframes ns-chicken {
  0%, 100% { transform: translateX(16px); }
  50%      { transform: translateX(-14px); }
}
/* Front: head slides sideways, level, over still shoulders. */
@keyframes ns-slide {
  0%, 100% { transform: translateX(-26px); }
  50%      { transform: translateX(26px); }
}
.ns-nod        { animation: ns-nod 5s ease-in-out infinite; }
.ns-shake      { animation: ns-shake 5s ease-in-out infinite; }
.ns-shake-head { animation: ns-shake-head 5s ease-in-out infinite; }
.ns-shake-face { animation: ns-shake-face 5s ease-in-out infinite; }
.ns-ears       { animation: ns-ears 5s ease-in-out infinite; }
.ns-arc        { animation: ns-arc 6s ease-in-out infinite; }
.ns-chicken    { animation: ns-chicken 4.5s ease-in-out infinite; }
.ns-slide      { animation: ns-slide 4.5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ns-nod, .ns-shake, .ns-shake-head, .ns-shake-face, .ns-ears,
  .ns-arc, .ns-chicken, .ns-slide { animation: none; }
}
`;
