'use client';

import { useMemo, useState } from 'react';
import { Reorder } from 'framer-motion';
import { resolveElectionWinner } from '@/lib/election/resolve';
import { Nomination, Vote } from '@/lib/election/types';
import { IRVDecisionTrace } from '@/components/pileated-woodpecker-election/IRVDecisionTrace';

const SEED_NOMS: Nomination[] = [
    { id: 'xian',       restaurantName: "Xi'an Gourmet House (Midtown)", nominatorName: 'seed', createdAt: 0 },
    { id: 'righteous',  restaurantName: 'The Righteous Room',            nominatorName: 'seed', createdAt: 0 },
    { id: 'krog',       restaurantName: "Krog (dealer's choice) + Krog brewski + Krog affiliated dessert", nominatorName: 'seed', createdAt: 0 },
    { id: 'lloyds',     restaurantName: "LLoyd's Restaurant & Lounge",   nominatorName: 'seed', createdAt: 0 },
    { id: 'limerick',   restaurantName: 'Limerick Junction Pub',         nominatorName: 'seed', createdAt: 0 },
    { id: 'manuels',    restaurantName: "Manuel's Tavern",               nominatorName: 'seed', createdAt: 0 },
];

interface PlaygroundVote {
    voterName: string;
    rankings: string[];
}

const SEED_VOTES: PlaygroundVote[] = [
    { voterName: 'Vish',        rankings: ['krog', 'lloyds'] },
    { voterName: 'Alexa',       rankings: ['limerick', 'lloyds', 'manuels', 'righteous', 'krog'] },
    { voterName: 'Christian',   rankings: ['manuels', 'krog', 'limerick', 'righteous', 'xian', 'lloyds'] },
    { voterName: 'Emily',       rankings: ['righteous', 'xian', 'krog', 'lloyds', 'limerick', 'manuels'] },
    { voterName: 'Rob Nikolai', rankings: ['xian', 'righteous', 'manuels', 'limerick'] },
    { voterName: 'Mike',        rankings: ['lloyds', 'krog', 'xian', 'righteous'] },
    { voterName: 'Erin',        rankings: ['lloyds', 'xian', 'limerick', 'manuels', 'righteous', 'krog'] },
];

export default function RunoffPlaygroundPage() {
    const [voters, setVoters] = useState<PlaygroundVote[]>(SEED_VOTES);

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

    const reorderRankings = (voterName: string, newRankings: string[]) => {
        setVoters(prev => prev.map(v =>
            v.voterName === voterName ? { ...v, rankings: newRankings } : v,
        ));
    };

    const toggleCandidate = (voterName: string, candidateId: string) => {
        setVoters(prev => prev.map(v => {
            if (v.voterName !== voterName) return v;
            return v.rankings.includes(candidateId)
                ? { ...v, rankings: v.rankings.filter(id => id !== candidateId) }
                : { ...v, rankings: [...v.rankings, candidateId] };
        }));
    };

    const reset = () => setVoters(SEED_VOTES);

    const moveVoter = (voterIdx: number, direction: -1 | 1) => {
        const target = voterIdx + direction;
        if (target < 0 || target >= voters.length) return;
        const next = [...voters];
        [next[voterIdx], next[target]] = [next[target], next[voterIdx]];
        setVoters(next);
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
                    Drag candidates up/down inside each ballot to reorder. Tap ✕ to remove,
                    tap an unranked candidate to add it back. Use ↑/↓ on each voter card to
                    change who voted first (affects the timing tiebreaker).
                </p>
                <button
                    onClick={reset}
                    className="mt-3 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black underline decoration-gray-300 hover:decoration-black"
                >
                    ← Reset to seed
                </button>
            </header>

            <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                    Ballots <span className="text-gray-300">(top of list = voted first)</span>
                </h2>
                <div className="space-y-3">
                    {voters.map((vote, voterIdx) => (
                        <div key={vote.voterName} className="bg-white border border-gray-200 p-4">
                            <BallotEditor
                                vote={vote}
                                voterIdx={voterIdx}
                                isFirst={voterIdx === 0}
                                isLast={voterIdx === voters.length - 1}
                                onReorder={r => reorderRankings(vote.voterName, r)}
                                onToggle={id => toggleCandidate(vote.voterName, id)}
                                onMoveUp={() => moveVoter(voterIdx, -1)}
                                onMoveDown={() => moveVoter(voterIdx, 1)}
                                nameOf={nameOf}
                            />
                        </div>
                    ))}
                </div>
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
                            {result.method === 'Ranked Pairs'
                                ? '⚖ Completed by Ranked Pairs (consensus)'
                                : `Decided cleanly by ${result.method}`}
                        </div>
                    )}
                </div>

                <IRVDecisionTrace
                    rounds={result.irvRounds}
                    nominations={SEED_NOMS}
                    voteStartTime={0}
                    finalWinnerId={result.winnerId}
                    finalMethod={result.method}
                    tieBroken={result.tieBroken}
                    winnerVoteTime={result.winnerVoteTime}
                    rankedPairs={result.rankedPairs}
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
