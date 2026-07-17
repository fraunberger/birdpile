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

interface Matchup {
    opponent: string;
    result: 'beats' | 'loses' | 'ties';
    votesFor: number;
    votesAgainst: number;
    // Decisive, but skipped when locking it would have closed a cycle — so it
    // played no part in the final ranking.
    skipped: boolean;
}

// Every nomination's full head-to-head record, built from the three
// pair-lists Ranked Pairs already produces (each pair appears in exactly one
// of them). Keyed by nomination id, in no particular order.
function buildMatchups(rp: RankedPairsResult): Record<string, Matchup[]> {
    const byId: Record<string, Matchup[]> = {};
    const add = (id: string, m: Matchup) => (byId[id] ??= []).push(m);

    for (const p of [...rp.lockedPairs, ...(rp.skippedPairs ?? [])]) {
        const skipped = (rp.skippedPairs ?? []).includes(p);
        add(p.winner, { opponent: p.loser, result: 'beats', votesFor: p.winnerVotes, votesAgainst: p.loserVotes, skipped });
        add(p.loser, { opponent: p.winner, result: 'loses', votesFor: p.loserVotes, votesAgainst: p.winnerVotes, skipped });
    }
    for (const t of rp.tiedPairs ?? []) {
        add(t.a, { opponent: t.b, result: 'ties', votesFor: t.votes, votesAgainst: t.votes, skipped: false });
        add(t.b, { opponent: t.a, result: 'ties', votesFor: t.votes, votesAgainst: t.votes, skipped: false });
    }
    return byId;
}

function recordFor(matchups: Matchup[]): string {
    const wins = matchups.filter(m => m.result === 'beats').length;
    const losses = matchups.filter(m => m.result === 'loses').length;
    const ties = matchups.filter(m => m.result === 'ties').length;
    return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function HeadToHeadCard({ rp, nameOf }: { rp: RankedPairsResult; nameOf: (id: string) => string }) {
    const tied = rp.tiedPairs ?? [];
    const smith = rp.smithSet ?? [];
    // No single unbeaten candidate → a genuine tie at the top.
    const tiedForFirst = !rp.weakCondorcetWinnerId;
    const hasCycle = (rp.skippedPairs ?? []).length > 0;
    const noPairs = rp.lockedPairs.length === 0 && (rp.skippedPairs ?? []).length === 0 && tied.length === 0;

    const matchupsById = buildMatchups(rp);
    const order = rp.ranking.length ? rp.ranking : Object.keys(matchupsById);
    const rankIndex = new Map(order.map((id, i) => [id, i]));

    return (
        <div className="bg-white border border-gray-200 p-4">
            <StepLabel n={1} title="Head-to-head (Condorcet)" />

            {noPairs ? (
                <div className="text-xs text-gray-500 mb-3">
                    No decisive head-to-head matchups — every pair tied.
                </div>
            ) : (
                <div className="divide-y divide-gray-100 mb-3">
                    {order.map(id => (
                        <NominationMatchupRow
                            key={id}
                            name={nameOf(id)}
                            record={recordFor(matchupsById[id] ?? [])}
                            matchups={[...(matchupsById[id] ?? [])].sort(
                                (a, b) => (rankIndex.get(a.opponent) ?? 0) - (rankIndex.get(b.opponent) ?? 0)
                            )}
                            nameOf={nameOf}
                            isWinner={id === rp.winnerId}
                        />
                    ))}
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

const RESULT_STYLE: Record<Matchup['result'], { verb: string; color: string }> = {
    beats: { verb: 'beat', color: 'text-green-700' },
    loses: { verb: 'lost to', color: 'text-gray-500' },
    ties: { verb: 'tied', color: 'text-gray-500' },
};

function NominationMatchupRow({
    name,
    record,
    matchups,
    nameOf,
    isWinner,
}: {
    name: string;
    record: string;
    matchups: Matchup[];
    nameOf: (id: string) => string;
    isWinner: boolean;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="py-2">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-2 text-sm text-left"
                aria-expanded={open}
            >
                <span className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>
                    &rsaquo;
                </span>
                <span className="font-bold">{name}</span>
                {isWinner && (
                    <span className="text-[10px] uppercase tracking-wider bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        winner
                    </span>
                )}
                <span className="ml-auto font-mono text-xs text-gray-500">{record}</span>
            </button>
            {open && (
                <div className="mt-2 ml-4 pl-3 border-l border-gray-100 space-y-1.5">
                    {matchups.map(m => {
                        const style = RESULT_STYLE[m.result];
                        return (
                            <div key={m.opponent} className="text-xs">
                                <div className="flex items-center gap-2">
                                    <span className={style.color}>{style.verb}</span>
                                    <span className="text-gray-700">{nameOf(m.opponent)}</span>
                                    <span className="ml-auto font-mono text-gray-400">
                                        {m.votesFor}–{m.votesAgainst}
                                    </span>
                                </div>
                                {m.skipped && (
                                    <div className="mt-0.5 text-[10px] text-amber-600">
                                        Not used — locking this would create a cycle
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
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
