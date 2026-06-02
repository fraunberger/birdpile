// Pure helpers for the coin-toss tiebreak, kept separate from the store so the
// threshold and draw can be unit-tested without storage.

/** A strict majority of the voters who cast a ballot have asked for a toss. */
export function hasCoinTossMajority(requesterCount: number, voterCount: number): boolean {
    return voterCount > 0 && requesterCount * 2 > voterCount;
}

/** Smallest number of requesters that triggers the toss. */
export function coinTossThreshold(voterCount: number): number {
    return Math.floor(voterCount / 2) + 1;
}

/** Pick one tied option uniformly at random (rng injectable for tests). */
export function drawCoinToss(tied: string[], rng: () => number = Math.random): string | null {
    if (tied.length === 0) return null;
    return tied[Math.floor(rng() * tied.length)];
}
