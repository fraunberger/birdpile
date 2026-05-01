
import { Nomination, Vote } from "./types";

export interface IRVResult {
    winnerId: string | null;
    tieBroken: boolean;
    winnerVoteTime?: number;
}

export function calculateIRV(nominations: Nomination[], votes: Vote[]): IRVResult {
    if (nominations.length === 0) return { winnerId: null, tieBroken: false };
    if (votes.length === 0) return { winnerId: null, tieBroken: false };

    let candidates = nominations.map(n => n.id);

    const getEarliestFirstVote = (candidateId: string): number => {
        const firstVotes = votes.filter(v => v.rankings[0] === candidateId);
        if (firstVotes.length === 0) return Infinity;
        return Math.min(...firstVotes.map(v => v.createdAt));
    };

    while (candidates.length > 1) {
        const activeVotes = votes.map(v => ({
            rankings: v.rankings.filter(id => candidates.includes(id))
        })).filter(v => v.rankings.length > 0);

        if (activeVotes.length === 0) break;

        const counts: Record<string, number> = {};
        candidates.forEach(id => counts[id] = 0);

        activeVotes.forEach(ballot => {
            const firstChoice = ballot.rankings[0];
            counts[firstChoice]++;
        });

        const totalVotes = activeVotes.length;

        // Check for majority
        for (const id of candidates) {
            if (counts[id] > totalVotes / 2) {
                return { winnerId: id, tieBroken: false };
            }
        }

        // Elimination — eliminate the candidate with the fewest first-choice votes.
        // If multiple candidates are tied for last (even if ALL remaining are tied),
        // eliminate the one whose earliest #1 vote came latest, then continue so
        // vote transfers can keep resolving the runoff. We only fall through to a
        // pure speed tiebreaker (below the loop) if IRV can't produce a majority.
        const minVotes = Math.min(...candidates.map(id => counts[id]));
        const losers = candidates.filter(id => counts[id] === minVotes);

        if (losers.length > 1) {
            const loserTimes = losers.map(id => ({ id, time: getEarliestFirstVote(id) }))
                .sort((a, b) => b.time - a.time);
            candidates = candidates.filter(id => id !== loserTimes[0].id);
        } else {
            candidates = candidates.filter(id => id !== losers[0]);
        }
    }

    // Loop exited without a majority winner — survivor (if any) won via tiebreaker.
    const winnerId = candidates[0] ?? null;
    if (!winnerId) return { winnerId: null, tieBroken: false };

    const winnerTime = getEarliestFirstVote(winnerId);
    return {
        winnerId,
        tieBroken: true,
        winnerVoteTime: Number.isFinite(winnerTime) ? winnerTime : undefined,
    };
}
