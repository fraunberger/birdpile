'use client';

import { useState } from 'react';
import type { CoinTossState, Nomination, WinnerMethod } from '@/lib/election/types';
import type { RankedPairsResult } from '@/lib/election/rankedPairs';
import type { BordaResult } from '@/lib/election/borda';
import type { SpeedResult } from '@/lib/election/resolve';

interface Props {
    nominations: Nomination[];
    finalWinnerId: string | null;
    finalMethod?: WinnerMethod;
    rankedPairs?: RankedPairsResult;
    borda?: BordaResult;
    speed?: SpeedResult;
    coinToss?: CoinTossState;
}

const ALGORITHM_EXPLAINER = `
Ranked Pairs is a voting method that figures out a winner by looking at every possible one-on-one matchup between the options.

Here's how it works:

1. Count every head-to-head matchup — for each pair of options, tally how many voters preferred A over B and how many preferred B over A.

2. Rank the matchups by margin — sort them from biggest blowout to closest race.

3. Lock them in, one by one — starting with the most decisive matchup, "lock in" each result unless doing so would create a contradiction (a cycle, like A beats B, B beats C, but C also beats A). Cycles get skipped.

4. The winner is whoever is never beaten in any locked matchup.

If there's still a tie at the top, a Borda count breaks it (each option scores points based on where voters ranked it). If that's still tied, whoever got their first supporting vote earliest wins. Dead-even? A coin toss.
`.trim();

/**
 * Shows the math that actually decided the winner: the head-to-head (Condorcet
 * via Ranked Pairs) analysis, then the Borda runoff if a tie needed it, then the
 * final tiebreak (speed or coin toss). Each step only renders if it was reached.
 */
export function DecisionTrace({
    nominations,
    finalWinnerId,
    finalMethod,
    rankedPairs,
    borda,
    speed,
}: Props) {
    if (!rankedPairs || !rankedPairs.winnerId) return null;
    const nameOf = (id: string) => nominations.find(n => n.id === id)?.restaurantName ?? id;

    const [explainerOpen, setExplainerOpen] = useState(false);

    return (
        <div className="max-w-2xl mx-auto mt-12 text-left">
            <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">
                    How was this decided?
                </h3>
                <button
                    onClick={() => setExplainerOpen(v => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-400 px-2 py-0.5 rounded transition-colors"
                >
                    {explainerOpen ? 'hide explainer' : 'how does this work?'}
                </button>
            </div>
            {explainerOpen && (
                <div className="mb-4 bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed">
                    <div className="font-semibold text-gray-800 mb-2">The Ranked Pairs algorithm</div>
                    {ALGORITHM_EXPLAINER.split('\n\n').map((para, i) => (
                        <p key={i} className={i > 0 ? 'mt-2' : ''}>{para}</p>
                    ))}
                </div>
            )}
            <div className="space-y-3">
                <HeadToHeadCard rp={rankedPairs} nameOf={nameOf} />
                {borda && <BordaCard borda={borda} nameOf={nameOf} />}
                {(finalMethod === 'Speed' || finalMethod === 'Coin Toss') && (
                    <TiebreakCard
                        method={finalMethod}
                        speed={speed}
                        finalWinnerId={finalWinnerId}
                        nameOf={nameOf}
                    />
                )}
                <FinalCard finalWinnerId={finalWinnerId} finalMethod={finalMethod} nameOf={nameOf} />
            </div>
        </div>
    );
}

function StepLabel({ n, title }: { n: number; title: string }) {
    return (
        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            Step {n} — {title}
        </div>
    );
}

const PAIRS_PREVIEW = 3;

function HeadToHeadCard({ rp, nameOf }: { rp: RankedPairsResult; nameOf: (id: string) => string }) {
    const skipped = rp.skippedPairs ?? [];
    const tied = rp.tiedPairs ?? [];
    const smith = rp.smithSet ?? [];
    // No single unbeaten candidate → a genuine tie at the top.
    const tiedForFirst = !rp.weakCondorcetWinnerId;
    const hasCycle = skipped.length > 0;
    const noPairs = rp.lockedPairs.length === 0 && skipped.length === 0;

    const allPairs = [
        ...rp.lockedPairs.map(p => ({ ...p, skipped: false })),
        ...skipped.map(p => ({ ...p, skipped: true })),
    ];
    const hasMore = allPairs.length > PAIRS_PREVIEW;
    const [expanded, setExpanded] = useState(false);
    const visiblePairs = expanded || !hasMore ? allPairs : allPairs.slice(0, PAIRS_PREVIEW);

    return (
        <div className="bg-white border border-gray-200 p-4">
            <StepLabel n={1} title="Head-to-head (Condorcet)" />

            {noPairs ? (
                <div className="text-xs text-gray-500 mb-3">
                    No decisive head-to-head matchups — every pair tied.
                </div>
            ) : (
                <div className="mb-3">
                    <div className="space-y-1.5">
                        {visiblePairs.map(p => p.skipped ? (
                            <div
                                key={`skip-${p.winner}-${p.loser}`}
                                className="flex items-center gap-2 text-sm text-amber-700"
                                title="Dropped: locking this would close a cycle"
                            >
                                <span className="font-bold">{nameOf(p.winner)}</span>
                                <span className="text-amber-400">beats</span>
                                <span>{nameOf(p.loser)}</span>
                                <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                    cycle — dropped
                                </span>
                                <span className="ml-auto font-mono text-xs text-amber-600">
                                    {p.winnerVotes}–{p.loserVotes}
                                </span>
                            </div>
                        ) : (
                            <div key={`${p.winner}-${p.loser}`} className="flex items-center gap-2 text-sm">
                                <span className="font-bold">{nameOf(p.winner)}</span>
                                <span className="text-gray-400">beats</span>
                                <span>{nameOf(p.loser)}</span>
                                <span className="ml-auto font-mono text-xs text-gray-500">
                                    {p.winnerVotes}–{p.loserVotes}
                                </span>
                            </div>
                        ))}
                    </div>
                    {hasMore && (
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
                        >
                            {expanded
                                ? 'show less'
                                : `+ ${allPairs.length - PAIRS_PREVIEW} more matchup${allPairs.length - PAIRS_PREVIEW === 1 ? '' : 's'}`}
                        </button>
                    )}
                </div>
            )}

            {tied.length > 0 && (
                <div className="text-[11px] text-gray-400 mb-3">
                    Ties: {tied.map(t => `${nameOf(t.a)} = ${nameOf(t.b)}`).join(' · ')}
                </div>
            )}

            <div className={`border-l-2 pl-3 py-1 ${tiedForFirst ? 'border-amber-400' : 'border-green-500'}`}>
                {tiedForFirst ? (
                    <div className="text-sm text-amber-800">
                        <span className="font-bold">{smith.map(nameOf).join(', ')}</span> are tied at the top —
                        {hasCycle
                            ? " they form a cycle (rock-paper-scissors), so no option beats the others."
                            : " each ties the others, so no option beats the others."}
                        {' '}It&apos;s a real tie; a Borda runoff (then speed, then a coin toss) decides.
                    </div>
                ) : rp.isCondorcetWinner ? (
                    <div className="text-sm text-green-700">
                        <span className="font-bold">{nameOf(rp.winnerId!)}</span> beats every other option
                        head-to-head — a clean Condorcet winner.
                    </div>
                ) : (
                    <div className="text-sm text-green-700">
                        <span className="font-bold">{nameOf(rp.winnerId!)}</span> is never beaten head-to-head
                        {rp.winnerRecord.ties.length > 0 && ` (ties ${rp.winnerRecord.ties.map(nameOf).join(', ')})`}
                        {' '}— so it wins.
                    </div>
                )}
            </div>
        </div>
    );
}

function BordaCard({ borda, nameOf }: { borda: BordaResult; nameOf: (id: string) => string }) {
    const max = Math.max(...Object.values(borda.scores), 1);
    const decided = borda.winners.length === 1;
    return (
        <div className="bg-white border border-gray-200 p-4">
            <StepLabel n={2} title="Borda runoff among the tied" />
            <div className="space-y-1.5 mb-3">
                {borda.ranking.map(id => {
                    const score = borda.scores[id] ?? 0;
                    const isWinner = decided && borda.winners[0] === id;
                    return (
                        <div key={id} className="flex items-center gap-2 text-sm">
                            <div className={`w-32 truncate ${isWinner ? 'font-bold' : ''}`}>{nameOf(id)}</div>
                            <div className="flex-1 h-3 bg-gray-100 relative">
                                <div
                                    className={`h-full ${isWinner ? 'bg-green-500' : 'bg-gray-500'}`}
                                    style={{ width: `${(score / max) * 100}%` }}
                                />
                            </div>
                            <div className="w-8 text-right font-mono text-gray-600">{score}</div>
                        </div>
                    );
                })}
            </div>
            <div className={`border-l-2 pl-3 py-1 ${decided ? 'border-green-500' : 'border-gray-300'}`}>
                <div className={`text-sm ${decided ? 'text-green-700' : 'text-gray-700'}`}>
                    {decided
                        ? <><span className="font-bold">{nameOf(borda.winners[0])}</span> has the highest Borda score — it wins.</>
                        : <>Still tied at {borda.scores[borda.winners[0]]} points ({borda.winners.map(nameOf).join(', ')}). On to the final tiebreak.</>}
                </div>
            </div>
        </div>
    );
}

function TiebreakCard({
    method,
    speed,
    finalWinnerId,
    nameOf,
}: {
    method: WinnerMethod;
    speed?: SpeedResult;
    finalWinnerId: string | null;
    nameOf: (id: string) => string;
}) {
    const isCoin = method === 'Coin Toss';
    return (
        <div className="bg-white border border-gray-200 p-4">
            <StepLabel n={3} title={isCoin ? 'Coin toss' : 'Speed tiebreak'} />
            {isCoin ? (
                <div className="border-l-2 border-purple-400 pl-3 py-1 text-sm text-gray-700">
                    A perfect tie. The group called a random toss between{' '}
                    <span className="font-bold">{(speed?.tied ?? []).map(nameOf).join(' & ') || 'the finalists'}</span>
                    {' '}— the wheel landed on{' '}
                    <span className="font-bold">{finalWinnerId ? nameOf(finalWinnerId) : '—'}</span>.
                </div>
            ) : (
                <>
                    {speed && (
                        <div className="space-y-1 mb-3 text-[11px] font-mono text-gray-500">
                            {[...speed.tied]
                                .sort((a, b) => speed.times[a] - speed.times[b])
                                .map(id => (
                                    <div key={id}>
                                        {nameOf(id)}: first support at{' '}
                                        {Number.isFinite(speed.times[id])
                                            ? new Date(speed.times[id]).toLocaleTimeString()
                                            : '—'}
                                    </div>
                                ))}
                        </div>
                    )}
                    <div className="border-l-2 border-green-500 pl-3 py-1 text-sm text-green-700">
                        <span className="font-bold">{finalWinnerId ? nameOf(finalWinnerId) : '—'}</span> had the earliest
                        supporting ballot, so it wins by speed.
                    </div>
                </>
            )}
        </div>
    );
}

function FinalCard({
    finalWinnerId,
    finalMethod,
    nameOf,
}: {
    finalWinnerId: string | null;
    finalMethod?: WinnerMethod;
    nameOf: (id: string) => string;
}) {
    if (!finalWinnerId) {
        return (
            <div className="bg-black text-white p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Final</div>
                <div className="font-bold">No winner could be determined.</div>
            </div>
        );
    }
    return (
        <div className="bg-black text-white p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Final decision</div>
            <div className="text-lg font-black uppercase tracking-tight mb-1">🏆 {nameOf(finalWinnerId)}</div>
            <div className="text-sm text-gray-300">Decided by {finalMethod ?? 'consensus'}.</div>
        </div>
    );
}
