import type { Vote } from "./types";

export interface BordaResult {
    pool: string[]; // candidates scored, in their deterministic base order
    scores: Record<string, number>;
    ranking: string[]; // pool sorted by score desc, base order breaking ties
    winners: string[]; // every candidate sharing the top score (>1 ⇒ still tied)
}

/**
 * Standard Borda count over a restricted pool of candidates. Each ballot is
 * collapsed to just the pool candidates, keeping their relative order; with
 * m = pool size, the voter's top surviving choice scores m-1, the next m-2, and
 * so on, while any pool candidate the voter left unranked scores 0.
 *
 * Used to break a Ranked Pairs tie for first place: the pool is the set of
 * co-leaders. (Note: for a two-way tie this necessarily re-ties — two-candidate
 * Borda is just the pairwise comparison, which is what tied them — so Borda only
 * ever separates a tie of three or more.)
 */
export function bordaCount(pool: string[], votes: Vote[]): BordaResult {
    const m = pool.length;
    const scores: Record<string, number> = {};
    pool.forEach(id => scores[id] = 0);

    if (m > 0) {
        for (const vote of votes) {
            const ranked = vote.rankings.filter(id => pool.includes(id));
            ranked.forEach((id, i) => {
                scores[id] += m - 1 - i;
            });
        }
    }

    const baseRank = new Map<string, number>(pool.map((id, i) => [id, i]));
    const ranking = [...pool].sort((a, b) => {
        if (scores[b] !== scores[a]) return scores[b] - scores[a];
        return baseRank.get(a)! - baseRank.get(b)!;
    });

    const top = ranking.length ? scores[ranking[0]] : 0;
    const winners = pool.filter(id => scores[id] === top);

    return { pool, scores, ranking, winners };
}
