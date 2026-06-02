import type { IRVRound, Nomination, Vote, WinnerMethod } from "./types";
import { calculateIRV } from "./irv";
import { rankedPairs } from "./rankedPairs";
import type { RankedPairsResult } from "./rankedPairs";
import { bordaCount } from "./borda";
import type { BordaResult } from "./borda";

export interface SpeedResult {
    tied: string[]; // candidates still tied going into the speed tiebreak
    times: Record<string, number>; // earliest supporting-ballot time for each
    winnerId: string; // the earliest of them
}

export interface ResolvedWinner {
    winnerId: string | null;
    method?: WinnerMethod;
    tieBroken: boolean;
    decidedBySpeed: boolean;
    // Co-leaders at the step that decided it ([] for a clean single winner).
    // Kept so the reveal can show "A vs B (B won by speed)".
    tiedOptions: string[];
    winnerVoteTime?: number; // speed winner's supporting-ballot time, for display
    irvRounds: IRVRound[];
    rankedPairs: RankedPairsResult;
    borda?: BordaResult;
    speed?: SpeedResult;
}

/**
 * The single source of truth for "who won". Every surface (finalize, list,
 * detail, playground) routes through here so they can never disagree.
 *
 * Resolution hierarchy:
 *   1. Condorcet via Ranked Pairs — if exactly one candidate is ranked above by
 *      nobody, they win. (A candidate who never loses but ties someone, like a
 *      broad consensus pick, still wins here; that's the whole point.)
 *   2. Borda — if Ranked Pairs leaves two or more genuinely co-equal at the top
 *      (mutual pairwise ties), break it with a Borda count among just them.
 *   3. Speed — if Borda is still a perfect tie, the candidate whose earliest
 *      supporting ballot came in first wins, and the full tied set is reported
 *      so the finish can show who edged it.
 *
 * Instant Runoff is computed only for the decision-trace visualization; it no
 * longer picks the winner (it suffers the center-squeeze the hierarchy avoids).
 */
export function resolveElectionWinner(nominations: Nomination[], votes: Vote[]): ResolvedWinner {
    const irvRounds = calculateIRV(nominations, votes).rounds;
    const rp = rankedPairs(nominations, votes);

    if (!rp.winnerId) {
        return {
            winnerId: null,
            tieBroken: false,
            decidedBySpeed: false,
            tiedOptions: [],
            irvRounds,
            rankedPairs: rp,
        };
    }

    // 1. Ranked Pairs settled it outright.
    if (rp.sources.length === 1) {
        return {
            winnerId: rp.winnerId,
            method: rp.isCondorcetWinner ? "Condorcet" : "Ranked Pairs",
            tieBroken: false,
            decidedBySpeed: false,
            tiedOptions: [],
            irvRounds,
            rankedPairs: rp,
        };
    }

    // 2. Genuine tie for first place → Borda among the co-leaders only.
    const borda = bordaCount(rp.sources, votes);
    if (borda.winners.length === 1) {
        return {
            winnerId: borda.winners[0],
            method: "Borda",
            tieBroken: true,
            decidedBySpeed: false,
            tiedOptions: rp.sources,
            irvRounds,
            rankedPairs: rp,
            borda,
        };
    }

    // 3. Still perfectly tied → earliest supporting ballot wins by speed.
    const stillTied = borda.winners;
    const times: Record<string, number> = {};
    for (const id of stillTied) {
        const supporting = votes.filter(v => v.rankings.includes(id)).map(v => v.createdAt);
        times[id] = supporting.length ? Math.min(...supporting) : Infinity;
    }
    const baseOrder = new Map<string, number>(nominations.map((n, i) => [n.id, i]));
    const speedWinner = [...stillTied].sort((a, b) =>
        times[a] !== times[b] ? times[a] - times[b] : baseOrder.get(a)! - baseOrder.get(b)!,
    )[0];

    return {
        winnerId: speedWinner,
        method: "Speed",
        tieBroken: true,
        decidedBySpeed: true,
        tiedOptions: stillTied,
        winnerVoteTime: Number.isFinite(times[speedWinner]) ? times[speedWinner] : undefined,
        irvRounds,
        rankedPairs: rp,
        borda,
        speed: { tied: stillTied, times, winnerId: speedWinner },
    };
}
