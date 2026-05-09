'use client';

import { EliminateOutcome, IRVRound, Nomination } from '@/lib/election/types';

interface Props {
    rounds: IRVRound[];
    nominations: Nomination[];
    voteStartTime: number;
    finalWinnerId: string | null;
    finalMethod?: 'Instant Runoff' | 'Condorcet';
    tieBroken: boolean;
    winnerVoteTime?: number;
}

export function IRVDecisionTrace({
    rounds,
    nominations,
    voteStartTime,
    finalWinnerId,
    finalMethod,
    tieBroken,
    winnerVoteTime,
}: Props) {
    if (!rounds || rounds.length === 0) return null;
    const nameOf = (id: string) => nominations.find(n => n.id === id)?.restaurantName ?? id;

    return (
        <div className="max-w-2xl mx-auto mt-12 text-left">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                How was this decided?
            </h3>
            <div className="space-y-3">
                {rounds.map((round, i) => (
                    <RoundCard
                        key={round.roundNumber}
                        round={round}
                        nameOf={nameOf}
                        isFirst={i === 0}
                    />
                ))}
                <FinalCard
                    rounds={rounds}
                    finalWinnerId={finalWinnerId}
                    finalMethod={finalMethod}
                    tieBroken={tieBroken}
                    winnerVoteTime={winnerVoteTime}
                    voteStartTime={voteStartTime}
                    nameOf={nameOf}
                />
            </div>
        </div>
    );
}

function RoundCard({
    round,
    nameOf,
    isFirst,
}: {
    round: IRVRound;
    nameOf: (id: string) => string;
    isFirst: boolean;
}) {
    const max = Math.max(...Object.values(round.counts), 1);
    const sorted = round.candidates
        .map(id => [id, round.counts[id] ?? 0] as const)
        .sort((a, b) => b[1] - a[1]);

    return (
        <div className="bg-white border border-gray-200 p-4">
            <div className="flex items-baseline justify-between mb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Round {round.roundNumber}
                </div>
                {isFirst && round.totalActiveVotes > 0 && (
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                        First-place votes
                    </div>
                )}
            </div>

            <div className="space-y-1.5 mb-4">
                {sorted.map(([id, count]) => {
                    const isEliminated =
                        round.outcome.type === 'eliminate' && round.outcome.eliminatedId === id;
                    const isWinner =
                        round.outcome.type === 'majority' && round.outcome.winnerId === id;
                    return (
                        <div key={id} className="flex items-center gap-2 text-sm">
                            <div
                                className={`w-32 truncate ${
                                    isEliminated ? 'text-red-600 line-through' : isWinner ? 'font-bold' : ''
                                }`}
                            >
                                {nameOf(id)}
                            </div>
                            <div className="flex-1 h-3 bg-gray-100 relative">
                                <div
                                    className={`h-full ${
                                        isWinner ? 'bg-green-500' : isEliminated ? 'bg-red-300' : 'bg-gray-500'
                                    }`}
                                    style={{ width: `${(count / max) * 100}%` }}
                                />
                            </div>
                            <div className="w-8 text-right font-mono text-gray-600">{count}</div>
                        </div>
                    );
                })}
            </div>

            <OutcomeBlock round={round} nameOf={nameOf} />
        </div>
    );
}

function OutcomeBlock({ round, nameOf }: { round: IRVRound; nameOf: (id: string) => string }) {
    const o = round.outcome;

    if (o.type === 'majority') {
        const pct = Math.round((o.count / o.total) * 100);
        return (
            <div className="border-l-2 border-green-500 pl-3 py-1">
                <div className="text-sm font-bold text-green-700">
                    {nameOf(o.winnerId)} wins outright
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                    Crossed a majority — {o.count} of {o.total} first-place votes ({pct}%, more than half).
                    No further rounds needed.
                </div>
            </div>
        );
    }

    if (o.type === 'no_active_votes') {
        return (
            <div className="border-l-2 border-gray-300 pl-3 py-1 text-xs text-gray-500">
                No active ballots remain — every voter&apos;s rankings have been eliminated.
            </div>
        );
    }

    return (
        <div className="border-l-2 border-red-300 pl-3 py-1">
            <div className="text-sm font-bold text-red-700">Eliminate {nameOf(o.eliminatedId)}</div>
            <div className="text-xs text-gray-600 mt-0.5">{describeElimination(o, nameOf)}</div>
            {o.reason !== 'sole_loser' && o.reason !== 'lookahead' && (
                <ReasonDetail outcome={o} nameOf={nameOf} />
            )}
        </div>
    );
}

function describeElimination(o: EliminateOutcome, nameOf: (id: string) => string): string {
    const others = o.tiedCandidates.filter(id => id !== o.eliminatedId).map(nameOf);
    const eliminatedName = nameOf(o.eliminatedId);

    if (o.reason === 'sole_loser') {
        return `Had the fewest first-place votes this round, with no tie for last.`;
    }

    if (o.reason === 'lookahead') {
        const proj = o.lookaheadProjections ?? {};
        const myProj = proj[o.eliminatedId];
        const cleanName = myProj?.winnerId ? nameOf(myProj.winnerId) : 'a clean winner';
        const otherDescs = Object.entries(proj)
            .filter(([id]) => id !== o.eliminatedId)
            .map(([id, p]) => {
                if (p.clean && p.winnerId) return `eliminating ${nameOf(id)} would lead to ${nameOf(p.winnerId)} winning instead`;
                return `eliminating ${nameOf(id)} would deadlock`;
            });
        return `Tied at the bottom with ${others.join(', ')}. Look-ahead: eliminating ${eliminatedName} produces a clean majority for ${cleanName}, while ${otherDescs.join(' and ')}. Take the decisive path.`;
    }

    if (o.reason === 'most_last_place') {
        const counts = o.lastPlaceCounts ?? {};
        const myCount = counts[o.eliminatedId] ?? 0;
        return `Tied at the bottom with ${others.join(', ')}. Look-ahead inconclusive. ${eliminatedName} is ranked dead last on ${myCount} ballot${myCount === 1 ? '' : 's'} — more than the others — so they're the weakest by depth of opposition.`;
    }

    if (o.reason === 'timing') {
        return `Still tied with ${others.join(', ')} after look-ahead and last-place tallies. Final fallback: ${eliminatedName} got their earliest #1 vote in the latest, so they're cut.`;
    }

    return '';
}

function ReasonDetail({ outcome, nameOf }: { outcome: EliminateOutcome; nameOf: (id: string) => string }) {
    if (outcome.reason === 'most_last_place' && outcome.lastPlaceCounts) {
        const entries = Object.entries(outcome.lastPlaceCounts).sort((a, b) => b[1] - a[1]);
        return (
            <div className="mt-2 text-[11px] font-mono text-gray-500">
                {entries.map(([id, c]) => (
                    <div key={id}>
                        {nameOf(id)}: last on {c} ballot{c === 1 ? '' : 's'}
                    </div>
                ))}
            </div>
        );
    }
    if (outcome.reason === 'timing' && outcome.earliestFirstVoteTimes) {
        const entries = Object.entries(outcome.earliestFirstVoteTimes).sort((a, b) => a[1] - b[1]);
        return (
            <div className="mt-2 text-[11px] font-mono text-gray-500">
                {entries.map(([id, t]) => (
                    <div key={id}>
                        {nameOf(id)}: first #1 at {new Date(t).toLocaleTimeString()}
                    </div>
                ))}
            </div>
        );
    }
    return null;
}

function FinalCard({
    rounds,
    finalWinnerId,
    finalMethod,
    tieBroken,
    winnerVoteTime,
    voteStartTime,
    nameOf,
}: {
    rounds: IRVRound[];
    finalWinnerId: string | null;
    finalMethod?: 'Instant Runoff' | 'Condorcet';
    tieBroken: boolean;
    winnerVoteTime?: number;
    voteStartTime: number;
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

    const winnerName = nameOf(finalWinnerId);
    const lastRound = rounds[rounds.length - 1];
    const irvMajorityWinner =
        lastRound?.outcome.type === 'majority' ? lastRound.outcome.winnerId : null;
    const irvAgrees = irvMajorityWinner === finalWinnerId;

    let body: string;

    if (finalMethod === 'Condorcet') {
        if (irvAgrees) {
            body = `Final method: Condorcet — ${winnerName} beats every other candidate in head-to-head pairwise matchups. Instant Runoff would have picked the same winner.`;
        } else if (irvMajorityWinner) {
            body = `Final method: Condorcet — ${winnerName} beats every other candidate in head-to-head pairwise matchups. (For comparison: Instant Runoff would have picked ${nameOf(irvMajorityWinner)} instead.)`;
        } else {
            body = `Instant Runoff couldn't produce a clear winner. Fell back to Condorcet — ${winnerName} beats every other candidate in head-to-head pairwise matchups.`;
        }
    } else if (tieBroken) {
        const seconds = Math.max(
            0,
            Math.floor(((winnerVoteTime ?? voteStartTime) - voteStartTime) / 1000)
        );
        body = `Neither Instant Runoff nor Condorcet produced a clear winner. As an absolute last resort, ${winnerName} wins by speed — earliest #1 vote among the tied candidates, ${seconds} seconds after voting opened.`;
    } else if (irvMajorityWinner) {
        body = `Won by Instant Runoff in round ${lastRound.roundNumber} with a true majority of first-place votes.`;
    } else {
        body = `Won by ${finalMethod ?? 'the active method'}.`;
    }

    return (
        <div className="bg-black text-white p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Final decision
            </div>
            <div className="text-lg font-black uppercase tracking-tight mb-2">
                🏆 {winnerName}
            </div>
            <div className="text-sm text-gray-300 leading-snug">{body}</div>
        </div>
    );
}
