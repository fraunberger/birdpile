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
            <h1 className="text-2xl font-bold tracking-tight">Neck Stretch</h1>
            <p className="text-sm text-gray-500 mt-1">
                Six moves, {STRETCH_SECONDS} seconds each. Slow cadence — whatever feels good.
            </p>

            <div className="mt-6 border border-black">
                <div className="p-6 flex flex-col items-center">
                    <Bird
                        key={active ? current.motion : "resting"}
                        motion={active ? current.motion : null}
                        paused={!running}
                    />

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

// --- The bird ---

type Choreo = {
    /** Nodding and the chicken are invisible head-on, so the swan looks away. */
    facing: "profile" | "you";
    seconds: number;
    /** Degrees each neck joint swings, from the body up. They accumulate. */
    joints: [number, number, number, number];
    /** Degrees the head swings on top of the neck. */
    head: number;
    /** The chin rides low through the middle of a sweep: pixels the neck lifts
     *  at the shoulder ends and drops as it crosses the centre. The drop is
     *  bounded by how far the neck's base can sink and stay hidden in the body. */
    dip?: { lift: number; drop: number };
    /** The head turns away from you instead of bending. */
    turn?: boolean;
};

// Every move is the neck's doing. Same-sign joints stack into a C-curve — the
// whole neck bends. Opposite-sign joints stack into an S-curve, which carries
// the head sideways with its eyes dead level: the chicken and the Janet.
const CHOREO: Record<Motion, Choreo> = {
    nod: { facing: "profile", seconds: 5, joints: [5, 8, 11, 14], head: 14 },
    shake: { facing: "you", seconds: 5, joints: [3, 4, 5, 6], head: 5, turn: true },
    ears: { facing: "you", seconds: 5, joints: [6, 8, 9, 10], head: 8 },
    arc: { facing: "you", seconds: 6, joints: [9, 11, 12, 13], head: 6, dip: { lift: 10, drop: 19 } },
    chicken: { facing: "profile", seconds: 4.5, joints: [20, 12, -12, -20], head: 0 },
    slide: { facing: "you", seconds: 4.5, joints: [18, 10, -10, -18], head: 0 },
};

// Neck joints from the body up; the last is where the head sits. The swan's
// S-curve is the rest pose, so every bend starts from a real neck shape.
const JOINTS: ReadonlyArray<readonly [number, number]> = [
    [128, 142],
    [120, 120],
    [120, 98],
    [128, 78],
    [136, 62],
];
const JOINT_WIDTHS = [13, 11, 10, 9];
const PROFILE_HEAD: readonly [number, number] = [139, 50];
const FACING_HEAD: readonly [number, number] = [136, 48];

const TAU = Math.PI * 2;

/**
 * Where every moving part sits at a point `p` (0 to 1) through one cycle.
 *
 * This is driven from a frame loop rather than declared as CSS or SMIL, and
 * that is the whole point: CSS animations are switched off entirely by the
 * viewer's reduce-motion setting, and WebKit does not reliably start SMIL on
 * an SVG that React mounts after load. Both failures are silent — the swan
 * renders and simply never moves, which is the one thing this app cannot do.
 * A frame loop runs wherever React runs.
 */
function poseAt(choreo: Choreo, p: number): Record<string, string> {
    const swing = Math.cos(TAU * p); // +1 at one end of the move, -1 at the other
    const pass = -Math.cos(2 * TAU * p); // -1 at both ends, +1 crossing the middle
    const pose: Record<string, string> = {};

    choreo.joints.forEach((degrees, i) => {
        const [x, y] = JOINTS[i];
        pose[`joint${i}`] = `rotate(${(degrees * swing).toFixed(2)} ${x} ${y})`;
    });

    const [hx, hy] = JOINTS[4];
    pose.head = `rotate(${(choreo.head * swing).toFixed(2)} ${hx} ${hy})`;

    if (choreo.dip) {
        const mid = (choreo.dip.drop - choreo.dip.lift) / 2;
        const reach = (choreo.dip.drop + choreo.dip.lift) / 2;
        pose.dip = `translate(0 ${(mid + reach * pass).toFixed(2)})`;
    }

    if (choreo.turn) {
        const [x, y] = FACING_HEAD;
        // The skull foreshortens as it turns away and fills out again as it
        // comes back through centre. Scale has no pivot of its own, so the
        // head is walked to the origin and back around it.
        const squeeze = (0.85 + 0.15 * pass).toFixed(3);
        pose.squeeze = `translate(${x} ${y}) scale(${squeeze} 1) translate(${-x} ${-y})`;
        pose.face = `translate(${(-8 * swing).toFixed(2)} 0)`;
    }

    return pose;
}

function Bird({ motion, paused }: { motion: Motion | null; paused: boolean }) {
    const svgRef = useRef<SVGSVGElement>(null);
    const phaseRef = useRef(0);
    const choreo = motion ? CHOREO[motion] : null;

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg || !choreo || paused) return;

        const parts = Array.from(svg.querySelectorAll<SVGGElement>("[data-slot]"));
        // Pick the cycle up where a pause left it, rather than snapping to rest.
        const startedAt = performance.now() - phaseRef.current * choreo.seconds * 1000;
        let frame = 0;

        const draw = (now: number) => {
            const cycles = (now - startedAt) / (choreo.seconds * 1000);
            const p = ((cycles % 1) + 1) % 1;
            phaseRef.current = p;
            const pose = poseAt(choreo, p);
            for (const part of parts) {
                const transform = pose[part.getAttribute("data-slot") ?? ""];
                if (transform) part.setAttribute("transform", transform);
            }
            frame = requestAnimationFrame(draw);
        };

        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [choreo, paused]);

    // The first paint is the start of the cycle, so nothing jumps when the
    // frame loop takes over — and a still swan still holds a real pose.
    const rest = choreo ? poseAt(choreo, 0) : {};

    // Build the head first, then wrap a joint around it for each vertebra, so
    // every joint carries everything above it. The neck bends; it does not
    // swing as one stick.
    let neck: React.ReactNode = (
        <g data-slot="head" transform={rest.head}>
            <Head
                at={choreo?.facing === "you" ? FACING_HEAD : PROFILE_HEAD}
                facing={choreo?.facing ?? "profile"}
                turning={choreo?.turn ?? false}
                rest={rest}
            />
        </g>
    );
    for (let i = JOINT_WIDTHS.length - 1; i >= 0; i--) {
        const [x0, y0] = JOINTS[i];
        const [x1, y1] = JOINTS[i + 1];
        const above = neck;
        neck = (
            <g data-slot={`joint${i}`} transform={rest[`joint${i}`]}>
                <path
                    d={`M${x0} ${y0} L${x1} ${y1}`}
                    stroke="#000"
                    strokeWidth={JOINT_WIDTHS[i]}
                    strokeLinecap="round"
                />
                {above}
            </g>
        );
    }

    return (
        <svg ref={svgRef} width={220} height={176} viewBox="0 0 220 176" aria-hidden="true">
            {/* The neck goes down first, so the body covers where it joins on. */}
            <g data-slot="dip" transform={rest.dip}>
                {neck}
            </g>

            <path
                d="M66 132 L34 112 L62 148 Z"
                fill="#fff"
                stroke="#000"
                strokeWidth={3}
                strokeLinejoin="round"
            />
            <ellipse cx={104} cy={144} rx={52} ry={25} fill="#fff" stroke="#000" strokeWidth={3} />
            <path
                d="M82 140 C96 126 128 128 142 144"
                fill="none"
                stroke="#000"
                strokeWidth={2.5}
                strokeLinecap="round"
            />

            {/* Water, so the body has something to sit still on. */}
            <path d="M10 158 H46" stroke="#d1d5db" strokeWidth={2.5} strokeLinecap="round" />
            <path d="M18 168 H60" stroke="#d1d5db" strokeWidth={2.5} strokeLinecap="round" />
            <path d="M164 162 H210" stroke="#d1d5db" strokeWidth={2.5} strokeLinecap="round" />
            <path d="M174 172 H206" stroke="#d1d5db" strokeWidth={2.5} strokeLinecap="round" />
        </svg>
    );
}

function Head({
    at,
    facing,
    turning,
    rest,
}: {
    at: readonly [number, number];
    facing: "profile" | "you";
    turning: boolean;
    rest: Record<string, string>;
}) {
    const [x, y] = at;

    if (facing === "profile") {
        return (
            <>
                <circle cx={x} cy={y} r={15} fill="#fff" stroke="#000" strokeWidth={3} />
                <circle cx={x + 5} cy={y - 4} r={2.4} fill="#000" />
                <path
                    d={`M${x + 12} ${y - 4} L${x + 31} ${y + 1} L${x + 12} ${y + 6} Z`}
                    fill="#f59e0b"
                    stroke="#000"
                    strokeWidth={2}
                    strokeLinejoin="round"
                />
            </>
        );
    }

    const face = (
        <>
            <circle cx={x} cy={y} r={15} fill="#fff" stroke="#000" strokeWidth={3} />
            <g data-slot="face" transform={rest.face}>
                <circle cx={x - 6} cy={y - 4} r={2.4} fill="#000" />
                <circle cx={x + 6} cy={y - 4} r={2.4} fill="#000" />
                <path
                    d={`M${x} ${y + 3} L${x - 7} ${y + 14} L${x + 7} ${y + 14} Z`}
                    fill="#f59e0b"
                    stroke="#000"
                    strokeWidth={2}
                    strokeLinejoin="round"
                />
            </g>
        </>
    );

    if (!turning) return face;

    return (
        <g data-slot="squeeze" transform={rest.squeeze}>
            {face}
        </g>
    );
}
