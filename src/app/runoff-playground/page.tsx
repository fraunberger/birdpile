'use client';

import { useMemo, useState } from 'react';
import { Reorder } from 'framer-motion';
import { resolveElectionWinner } from '@/lib/election/resolve';
import type { Nomination, Vote } from '@/lib/election/types';
import { DecisionTrace } from '@/components/pileated-woodpecker-election/DecisionTrace';

const SEED_NOMS: Nomination[] = [
    { id: 'xian',       restaurantName: "Xi'an Gourmet House (Midtown)", nominatorName: 'seed', createdAt: 0 },
    { id: 'righteous',  restaurantName: 'The Righteous Room',            nominatorName: 'seed', createdAt: 0 },
    { id: 'krog',       restaurantName: "Krog (dealer's choice) + Krog brewski + Krog affiliated dessert", nominatorName: 'seed', createdAt: 0 },
    { id: 'lloyds',     restaurantName: "LLoyd's Restaurant & Lounge",   nominatorName: 'seed', createdAt: 0 },
    { id: 'limerick',   restaurantName: 'Limerick Junction Pub',         nominatorName: 'seed', createdAt: 0 },
    { id: 'manuels',    restaurantName: "Manuel's Tavern",               nominatorName: 'seed', createdAt: 0 },
];

interface PlaygroundVote {
    id: string;
    voterName: string;
    rankings: string[];
}

let _seq = 0;
const mk = (voterName: string, rankings: string[]): PlaygroundVote => ({ id: `pv${++_seq}`, voterName, rankings });

interface Preset {
    key: string;
    label: string;
    hint: string;
    build: () => PlaygroundVote[];
}

// One-click scenarios. Each rebuilds with fresh ids so the cards remount cleanly.
const PRESETS: Preset[] = [
    {
        key: 'seed',
        label: 'Seed (7)',
        hint: 'The original messy demo set.',
        build: () => [
            mk('Vish', ['krog', 'lloyds']),
            mk('Alexa', ['limerick', 'lloyds', 'manuels', 'righteous', 'krog']),
            mk('Christian', ['manuels', 'krog', 'limerick', 'righteous', 'xian', 'lloyds']),
            mk('Emily', ['righteous', 'xian', 'krog', 'lloyds', 'limerick', 'manuels']),
            mk('Rob Nikolai', ['xian', 'righteous', 'manuels', 'limerick']),
            mk('Mike', ['lloyds', 'krog', 'xian', 'righteous']),
            mk('Erin', ['lloyds', 'xian', 'limerick', 'manuels', 'righteous', 'krog']),
        ],
    },
    {
        key: 'consensus',
        label: 'Consensus (Condorcet)',
        hint: "Krog is everyone's #2 and nobody's #1 — wins on head-to-head, but IRV would eliminate it first.",
        build: () => [
            mk('Ana', ['xian', 'krog']),
            mk('Ben', ['righteous', 'krog']),
            mk('Cara', ['manuels', 'krog']),
            mk('Dan', ['limerick', 'krog']),
        ],
    },
    {
        key: 'tie3',
        label: '3-way tie → Borda',
        hint: 'Xi’an, Righteous and Manuel’s all tie head-to-head, so a Borda runoff among them decides (Manuel’s wins 4 to 3/3).',
        build: () => [
            mk('Ana', ['xian', 'righteous']),
            mk('Ben', ['righteous', 'xian']),
            mk('Cara', ['manuels']),
            mk('Dan', ['manuels']),
        ],
    },
    {
        key: 'cycle',
        label: 'Cycle → 3-way tie',
        hint: 'Rock-paper-scissors: Xi’an > Righteous > Manuel’s > Xi’an. No option beats the others, so it’s a genuine tie (Borda ties too → speed, and a real election could coin-toss it).',
        build: () => [
            mk('Ana', ['xian', 'righteous', 'manuels']),
            mk('Ben', ['righteous', 'manuels', 'xian']),
            mk('Cara', ['manuels', 'xian', 'righteous']),
        ],
    },
    {
        key: 'coin',
        label: 'Perfect tie → Speed',
        hint: 'Two options tie on everything; the earliest supporter wins by speed (and a real election could call a coin toss).',
        build: () => [
            mk('Ana', ['xian']),
            mk('Ben', ['righteous']),
        ],
    },
];

export default function RunoffPlaygroundPage() {
    const [voters, setVoters] = useState<PlaygroundVote[]>(() => PRESETS[0].build());
    const [activePreset, setActivePreset] = useState<string | null>('seed');

    // Vote order in the array = chronological order. First voter has the earliest timestamp.
    const votesWithTimestamps = useMemo<Vote[]>(
        () => voters.map((v, i) => ({
            voterName: v.voterName,
            rankings: v.rankings,
            createdAt: 1000 * (i + 1),
        })),
        [voters],
    );

    const result = useMemo(
        () => resolveElectionWinner(SEED_NOMS, votesWithTimestamps),
        [votesWithTimestamps],
    );

    // Any hand-edit clears the active-preset highlight.
    const edit = (updater: (prev: PlaygroundVote[]) => PlaygroundVote[]) => {
        setVoters(updater);
        setActivePreset(null);
    };

    const loadPreset = (p: Preset) => {
        setVoters(p.build());
        setActivePreset(p.key);
    };

    const reorderRankings = (id: string, newRankings: string[]) =>
        edit(prev => prev.map(v => (v.id === id ? { ...v, rankings: newRankings } : v)));

    const toggleCandidate = (id: string, candidateId: string) =>
        edit(prev => prev.map(v => {
            if (v.id !== id) return v;
            return v.rankings.includes(candidateId)
                ? { ...v, rankings: v.rankings.filter(c => c !== candidateId) }
                : { ...v, rankings: [...v.rankings, candidateId] };
        }));

    const removeVoter = (id: string) => edit(prev => prev.filter(v => v.id !== id));

    const addVoter = () => edit(prev => [...prev, mk(`Voter ${prev.length + 1}`, [])]);

    const moveVoter = (voterIdx: number, direction: -1 | 1) => {
        const target = voterIdx + direction;
        if (target < 0 || target >= voters.length) return;
        edit(prev => {
            const next = [...prev];
            [next[voterIdx], next[target]] = [next[target], next[voterIdx]];
            return next;
        });
    };

    const nameOf = (id: string) => SEED_NOMS.find(n => n.id === id)?.restaurantName ?? id;
    const winnerName = result.winnerId ? nameOf(result.winnerId) : null;

    return (
        <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8 text-gray-900">
            <header>
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter">
                    Runoff Playground
                </h1>
                <p className="text-sm text-gray-500 mt-2 leading-snug">
                    Load a scenario, or build your own: add/remove voters, drag candidates to
                    reorder a ballot, tap ✕ to drop one or tap an unranked candidate to add it.
                    Use ↑/↓ to change who voted first (affects the speed tiebreaker).
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                    {PRESETS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => loadPreset(p)}
                            title={p.hint}
                            className={`text-xs font-bold uppercase tracking-wider px-3 py-2 border-2 transition-colors ${
                                activePreset === p.key
                                    ? 'bg-black text-white border-black'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {activePreset && (
                    <p className="mt-2 text-xs text-gray-400 leading-snug">
                        {PRESETS.find(p => p.key === activePreset)?.hint}
                    </p>
                )}
            </header>

            <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                    Ballots <span className="text-gray-300">(top of list = voted first)</span>
                </h2>
                <div className="space-y-3">
                    {voters.map((vote, voterIdx) => (
                        <div key={vote.id} className="bg-white border border-gray-200 p-4">
                            <BallotEditor
                                vote={vote}
                                voterIdx={voterIdx}
                                isFirst={voterIdx === 0}
                                isLast={voterIdx === voters.length - 1}
                                onReorder={r => reorderRankings(vote.id, r)}
                                onToggle={id => toggleCandidate(vote.id, id)}
                                onMoveUp={() => moveVoter(voterIdx, -1)}
                                onMoveDown={() => moveVoter(voterIdx, 1)}
                                onRemove={() => removeVoter(vote.id)}
                                nameOf={nameOf}
                            />
                        </div>
                    ))}
                    {voters.length === 0 && (
                        <div className="text-sm text-gray-400 italic text-center py-6 border border-dashed border-gray-200">
                            No voters. Add one or load a scenario above.
                        </div>
                    )}
                </div>
                <button
                    onClick={addVoter}
                    className="mt-3 text-xs font-bold uppercase tracking-wider px-3 py-2 border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-500 hover:text-black transition-colors w-full"
                >
                    + Add voter ({voters.length} total)
                </button>
            </section>

            <section className="border-t-2 border-dashed border-gray-300 pt-8">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                    Live result
                </h2>
                <div className="bg-black text-white p-5 mb-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                        Winner
                    </div>
                    <div className="text-2xl font-black uppercase tracking-tight">
                        🏆 {winnerName ?? 'No winner yet'}
                    </div>
                    {result.method && (
                        <div className="text-[11px] text-gray-300 mt-2 uppercase tracking-wider">
                            {result.method === 'Borda'
                                ? '➗ Broke a top tie with Borda'
                                : result.method === 'Speed'
                                ? '⚡ Perfect tie — decided by speed'
                                : result.method === 'Ranked Pairs'
                                ? '⚖ Decided by Ranked Pairs (consensus)'
                                : `Decided by ${result.method}`}
                        </div>
                    )}
                    {result.decidedBySpeed && result.speed && (
                        <div className="text-[11px] text-yellow-300 mt-1">
                            📸 {result.speed.tied.map(nameOf).join(' vs ')} — {nameOf(result.speed.winnerId)} won by speed
                        </div>
                    )}
                </div>

                <DecisionTrace
                    nominations={SEED_NOMS}
                    finalWinnerId={result.winnerId}
                    finalMethod={result.method}
                    rankedPairs={result.rankedPairs}
                    borda={result.borda}
                    speed={result.speed}
                />
            </section>
        </main>
    );
}

function BallotEditor({
    vote,
    voterIdx,
    isFirst,
    isLast,
    onReorder,
    onToggle,
    onMoveUp,
    onMoveDown,
    onRemove,
    nameOf,
}: {
    vote: PlaygroundVote;
    voterIdx: number;
    isFirst: boolean;
    isLast: boolean;
    onReorder: (rankings: string[]) => void;
    onToggle: (id: string) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemove: () => void;
    nameOf: (id: string) => string;
}) {
    const unranked = SEED_NOMS.filter(n => !vote.rankings.includes(n.id));

    return (
        <div>
            <div className="flex items-center justify-between mb-3 select-none">
                <div className="flex items-baseline gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                        {vote.voterName}
                    </h3>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                        Voter #{voterIdx + 1}
                    </span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={onMoveUp}
                        disabled={isFirst}
                        className="text-xs px-2 py-0.5 border border-gray-200 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move voter earlier"
                    >
                        ↑
                    </button>
                    <button
                        onClick={onMoveDown}
                        disabled={isLast}
                        className="text-xs px-2 py-0.5 border border-gray-200 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move voter later"
                    >
                        ↓
                    </button>
                    <button
                        onClick={onRemove}
                        className="text-xs px-2 py-0.5 border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-600"
                        aria-label="Remove voter"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {vote.rankings.length > 0 ? (
                <Reorder.Group
                    axis="y"
                    values={vote.rankings}
                    onReorder={onReorder}
                    className="space-y-1 mb-2"
                >
                    {vote.rankings.map((id, i) => (
                        <Reorder.Item
                            key={id}
                            value={id}
                            className="bg-gray-50 border border-gray-200 px-3 py-2 flex items-center gap-2 text-sm touch-none cursor-move"
                        >
                            <span className="font-mono text-gray-400 w-5">{i + 1}.</span>
                            <span className="flex-1 leading-tight">{nameOf(id)}</span>
                            <button
                                onClick={e => { e.stopPropagation(); onToggle(id); }}
                                className="text-gray-400 hover:text-red-600 text-xs px-1"
                                aria-label="Remove"
                            >
                                ✕
                            </button>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            ) : (
                <div className="text-xs text-gray-400 italic mb-2">No rankings — empty ballot.</div>
            )}

            {unranked.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-1 self-center">
                        + add:
                    </span>
                    {unranked.map(n => (
                        <button
                            key={n.id}
                            onClick={() => onToggle(n.id)}
                            className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 text-left max-w-[200px] truncate"
                            title={n.restaurantName}
                        >
                            {n.restaurantName}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
