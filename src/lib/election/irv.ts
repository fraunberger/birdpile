import { EliminateOutcome, IRVRound, Nomination, Vote } from "./types";

export interface IRVResult {
    winnerId: string | null;
    tieBroken: boolean;
    winnerVoteTime?: number;
    rounds: IRVRound[];
}

export function calculateIRV(nominations: Nomination[], votes: Vote[]): IRVResult {
    return runIRV(nominations.map(n => n.id), votes, true);
}

function runIRV(initialCandidates: string[], votes: Vote[], allowLookahead: boolean): IRVResult {
    const rounds: IRVRound[] = [];
    if (initialCandidates.length === 0 || votes.length === 0) {
        return { winnerId: null, tieBroken: false, rounds };
    }

    let candidates = [...initialCandidates];
    let roundNumber = 0;

    const earliestFirstVote = (id: string): number => {
        const f = votes.filter(v => v.rankings[0] === id);
        return f.length === 0 ? Infinity : Math.min(...f.map(v => v.createdAt));
    };

    // Count ballots where `id` is the lowest-ranked among the still-active candidates.
    const lastPlaceCount = (id: string, current: string[]): number => {
        return votes.reduce((acc, v) => {
            const active = v.rankings.filter(r => current.includes(r));
            if (active.length === 0) return acc;
            return active[active.length - 1] === id ? acc + 1 : acc;
        }, 0);
    };

    while (candidates.length > 1) {
        roundNumber++;
        const activeVotes = votes.map(v => ({
            rankings: v.rankings.filter(id => candidates.includes(id))
        })).filter(v => v.rankings.length > 0);

        const counts: Record<string, number> = {};
        candidates.forEach(id => counts[id] = 0);

        if (activeVotes.length === 0) {
            rounds.push({
                roundNumber,
                candidates: [...candidates],
                counts,
                totalActiveVotes: 0,
                outcome: { type: 'no_active_votes' },
            });
            break;
        }

        activeVotes.forEach(b => counts[b.rankings[0]]++);
        const totalActiveVotes = activeVotes.length;

        const majorityWinner = candidates.find(id => counts[id] > totalActiveVotes / 2);
        if (majorityWinner) {
            rounds.push({
                roundNumber,
                candidates: [...candidates],
                counts: { ...counts },
                totalActiveVotes,
                outcome: {
                    type: 'majority',
                    winnerId: majorityWinner,
                    count: counts[majorityWinner],
                    total: totalActiveVotes,
                },
            });
            return { winnerId: majorityWinner, tieBroken: false, rounds };
        }

        const minVotes = Math.min(...candidates.map(id => counts[id]));
        const losers = candidates.filter(id => counts[id] === minVotes);

        const outcome: EliminateOutcome = losers.length === 1
            ? { type: 'eliminate', eliminatedId: losers[0], reason: 'sole_loser', tiedCandidates: [] }
            : resolveTie(losers, candidates, votes, allowLookahead, lastPlaceCount, earliestFirstVote);

        rounds.push({
            roundNumber,
            candidates: [...candidates],
            counts: { ...counts },
            totalActiveVotes,
            outcome,
        });

        candidates = candidates.filter(id => id !== outcome.eliminatedId);
    }

    const winnerId = candidates[0] ?? null;
    if (!winnerId) return { winnerId: null, tieBroken: false, rounds };

    // Survivor without ever crossing majority means tiebreakers got us here.
    const hadTiebreaker = rounds.some(r =>
        r.outcome.type === 'eliminate' && r.outcome.reason !== 'sole_loser'
    );
    const winnerTime = earliestFirstVote(winnerId);
    return {
        winnerId,
        tieBroken: hadTiebreaker,
        winnerVoteTime: Number.isFinite(winnerTime) ? winnerTime : undefined,
        rounds,
    };
}

function resolveTie(
    losers: string[],
    candidates: string[],
    votes: Vote[],
    allowLookahead: boolean,
    lastPlaceCount: (id: string, current: string[]) => number,
    earliestFirstVote: (id: string) => number,
): EliminateOutcome {
    // 1. Look-ahead — simulate each elimination using only the deterministic
    //    fallbacks (most-last-place → timing). If exactly one elimination
    //    produces a majority winner downstream, prefer that one.
    if (allowLookahead) {
        const projections: Record<string, { winnerId: string | null; clean: boolean }> = {};
        for (const toElim of losers) {
            const remaining = candidates.filter(id => id !== toElim);
            const sub = runIRV(remaining, votes, false);
            projections[toElim] = {
                winnerId: sub.winnerId,
                clean: !sub.tieBroken && !!sub.winnerId,
            };
        }
        const cleanCandidates = losers.filter(id => projections[id].clean);
        if (cleanCandidates.length === 1) {
            return {
                type: 'eliminate',
                eliminatedId: cleanCandidates[0],
                reason: 'lookahead',
                tiedCandidates: losers,
                lookaheadProjections: projections,
            };
        }
    }

    // 2. Most last-place votes — eliminate whoever the most ballots rank dead
    //    last among the still-active candidates.
    const lastCounts: Record<string, number> = {};
    losers.forEach(id => lastCounts[id] = lastPlaceCount(id, candidates));
    const maxLast = Math.max(...losers.map(id => lastCounts[id]));
    const mostLast = losers.filter(id => lastCounts[id] === maxLast);
    if (mostLast.length === 1) {
        return {
            type: 'eliminate',
            eliminatedId: mostLast[0],
            reason: 'most_last_place',
            tiedCandidates: losers,
            lastPlaceCounts: lastCounts,
        };
    }

    // 3. Timing — eliminate the candidate whose earliest #1 vote came in latest.
    const times: Record<string, number> = {};
    mostLast.forEach(id => times[id] = earliestFirstVote(id));
    const sorted = mostLast.slice().sort((a, b) => times[b] - times[a]);
    return {
        type: 'eliminate',
        eliminatedId: sorted[0],
        reason: 'timing',
        tiedCandidates: losers,
        earliestFirstVoteTimes: times,
    };
}
