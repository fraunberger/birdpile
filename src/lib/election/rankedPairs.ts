import type { Nomination, Vote } from "./types";
import { calculatePairwiseMatrix } from "./condorcet";

export interface LockedPair {
    winner: string;
    loser: string;
    winnerVotes: number; // voters preferring winner over loser
    loserVotes: number; // voters preferring loser over winner
    margin: number; // winnerVotes - loserVotes (always > 0)
}

export interface RankedPairsResult {
    winnerId: string | null;
    // True when the winner strictly beats every other candidate head-to-head
    // (a real Condorcet winner). When false, the winner emerged from completing
    // a cycle / breaking pairwise ties — still deterministic, just not unanimous.
    isCondorcetWinner: boolean;
    // The candidates with no locked edge pointing into them — i.e. nobody is
    // ranked above them. Exactly one means a clean Ranked Pairs winner; more
    // than one means a genuine tie at the very top (mutual pairwise ties) that a
    // later method has to break. Ordered by the deterministic base order.
    sources: string[];
    ranking: string[]; // full deterministic ordering, strongest first
    lockedPairs: LockedPair[]; // edges locked in: winner ranked above loser
    // The winner's head-to-head record, for human-readable explanation.
    winnerRecord: { beats: string[]; ties: string[]; losesTo: string[] };
}

/**
 * Ranked Pairs (Tideman) — a Condorcet-consistent, Smith-efficient completion
 * method. Unlike Instant Runoff, it never eliminates a broadly-preferred
 * "consensus" candidate just because they hold few first-place votes, and it
 * resolves cycles deterministically rather than by an arbitrary tiebreak.
 *
 * Determinism: every step has a total tiebreak order derived from the
 * `nominations` array order (earlier nomination = preferred when all else is
 * equal). Given identical inputs it always returns the identical winner.
 */
export function rankedPairs(nominations: Nomination[], votes: Vote[]): RankedPairsResult {
    const ids = nominations.map(n => n.id);
    const empty: RankedPairsResult = {
        winnerId: null,
        isCondorcetWinner: false,
        sources: [],
        ranking: [],
        lockedPairs: [],
        winnerRecord: { beats: [], ties: [], losesTo: [] },
    };
    if (ids.length === 0 || votes.length === 0) return empty;
    if (ids.length === 1) {
        return { ...empty, winnerId: ids[0], isCondorcetWinner: true, sources: [ids[0]], ranking: [ids[0]] };
    }

    const pw = calculatePairwiseMatrix(nominations, votes);
    // Deterministic tiebreak rank: index in the (creation-ordered) nominations.
    const baseRank = new Map<string, number>(ids.map((id, i) => [id, i]));

    // 1. Build the set of decisive pairwise majorities (one directed edge per
    //    pair where one candidate is preferred over the other). Pairwise ties
    //    produce no edge.
    const majorities: LockedPair[] = [];
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = ids[i];
            const b = ids[j];
            const ab = pw[a][b];
            const ba = pw[b][a];
            if (ab === ba) continue; // pairwise tie — no edge
            const [winner, loser, wv, lv] = ab > ba ? [a, b, ab, ba] : [b, a, ba, ab];
            majorities.push({ winner, loser, winnerVotes: wv, loserVotes: lv, margin: wv - lv });
        }
    }

    // 2. Sort majorities strongest-first: by margin, then by winning votes, then
    //    by the deterministic base order of the winner, then of the loser.
    majorities.sort((x, y) => {
        if (y.margin !== x.margin) return y.margin - x.margin;
        if (y.winnerVotes !== x.winnerVotes) return y.winnerVotes - x.winnerVotes;
        const wr = baseRank.get(x.winner)! - baseRank.get(y.winner)!;
        if (wr !== 0) return wr;
        return baseRank.get(x.loser)! - baseRank.get(y.loser)!;
    });

    // 3. Lock each majority in turn, skipping any that would create a cycle with
    //    the edges already locked.
    const adjacency = new Map<string, Set<string>>(ids.map(id => [id, new Set<string>()]));
    const canReach = (from: string, to: string): boolean => {
        if (from === to) return true;
        const seen = new Set<string>([from]);
        const stack = [from];
        while (stack.length) {
            const node = stack.pop()!;
            for (const next of adjacency.get(node)!) {
                if (next === to) return true;
                if (!seen.has(next)) {
                    seen.add(next);
                    stack.push(next);
                }
            }
        }
        return false;
    };

    const lockedPairs: LockedPair[] = [];
    for (const m of majorities) {
        // Adding winner -> loser would cycle iff loser already reaches winner.
        if (canReach(m.loser, m.winner)) continue;
        adjacency.get(m.winner)!.add(m.loser);
        lockedPairs.push(m);
    }

    // 4. Produce a full deterministic ranking by repeatedly taking a "source"
    //    (a candidate with no locked edge pointing into it among those left),
    //    breaking ties by base order. The winner is the first source.
    const incoming = new Map<string, number>(ids.map(id => [id, 0]));
    for (const { loser } of lockedPairs) incoming.set(loser, incoming.get(loser)! + 1);

    // The top tier: every candidate nobody is ranked above, in base order. One
    // means a clean winner; several means a genuine tie for first place.
    const sources = ids.filter(id => incoming.get(id)! === 0)
        .sort((a, b) => baseRank.get(a)! - baseRank.get(b)!);

    const remaining = new Set(ids);
    const removedInto = new Map<string, number>(incoming);
    const ranking: string[] = [];
    while (remaining.size) {
        const available = [...remaining].filter(id => removedInto.get(id)! === 0);
        // With pairwise ties there can be more than one available node; the
        // deterministic base order decides. A DAG always has at least one.
        const pick = available.sort((a, b) => baseRank.get(a)! - baseRank.get(b)!)[0];
        ranking.push(pick);
        remaining.delete(pick);
        for (const loser of adjacency.get(pick)!) {
            if (remaining.has(loser)) removedInto.set(loser, removedInto.get(loser)! - 1);
        }
    }

    const winnerId = ranking[0] ?? null;
    const winnerRecord = { beats: [] as string[], ties: [] as string[], losesTo: [] as string[] };
    if (winnerId) {
        for (const other of ids) {
            if (other === winnerId) continue;
            const w = pw[winnerId][other];
            const l = pw[other][winnerId];
            if (w > l) winnerRecord.beats.push(other);
            else if (w < l) winnerRecord.losesTo.push(other);
            else winnerRecord.ties.push(other);
        }
    }

    return {
        winnerId,
        isCondorcetWinner: !!winnerId && winnerRecord.losesTo.length === 0 && winnerRecord.ties.length === 0,
        sources,
        ranking,
        lockedPairs,
        winnerRecord,
    };
}
