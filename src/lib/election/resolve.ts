import type { IRVRound, Nomination, Vote, WinnerMethod } from "./types";
import { calculateIRV } from "./irv";
import { rankedPairs } from "./rankedPairs";
import type { RankedPairsResult } from "./rankedPairs";

export interface ResolvedWinner {
    winnerId: string | null;
    method?: WinnerMethod;
    tieBroken: boolean;
    winnerVoteTime?: number;
    irvRounds: IRVRound[];
    rankedPairs: RankedPairsResult;
}

/**
 * The single source of truth for "who won". Every surface (finalize, list,
 * detail, playground) routes through here so they can never disagree.
 *
 * Resolution order:
 *   1. A "clean" win — one a method settles outright with no tiebreak. The
 *      election's chosen algorithm gets first crack, then the other.
 *   2. Otherwise Ranked Pairs completes the result. This is the bulletproof
 *      backstop: deterministic, Condorcet-consistent, and immune to the
 *      center-squeeze where IRV eliminates a consensus candidate (one ranked
 *      highly on most ballots but first on few) and then breaks the leftover
 *      tie essentially at random.
 */
export function resolveElectionWinner(
    nominations: Nomination[],
    votes: Vote[],
    votingAlgorithm?: 'condorcet' | 'irv',
): ResolvedWinner {
    const irv = calculateIRV(nominations, votes);
    const rp = rankedPairs(nominations, votes);

    const cleanIrv = irv.winnerId && !irv.tieBroken
        ? { winner: irv.winnerId, method: "Instant Runoff" as WinnerMethod }
        : null;
    const cleanCondorcet = rp.isCondorcetWinner && rp.winnerId
        ? { winner: rp.winnerId, method: "Condorcet" as WinnerMethod }
        : null;

    const cascade = votingAlgorithm === 'condorcet'
        ? [cleanCondorcet, cleanIrv]
        : [cleanIrv, cleanCondorcet];
    const clean = cascade.find(r => r !== null) ?? null;

    if (clean) {
        return {
            winnerId: clean.winner,
            method: clean.method,
            tieBroken: false,
            irvRounds: irv.rounds,
            rankedPairs: rp,
        };
    }

    return {
        winnerId: rp.winnerId,
        method: rp.winnerId ? "Ranked Pairs" : undefined,
        tieBroken: !!rp.winnerId,
        irvRounds: irv.rounds,
        rankedPairs: rp,
    };
}
