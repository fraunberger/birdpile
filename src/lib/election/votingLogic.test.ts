import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Nomination, Vote } from './types';
import { calculateIRV } from './irv';
import { rankedPairs } from './rankedPairs';
import { determineCondorcetWinner } from './condorcet';
import { resolveElectionWinner } from './resolve';

// ---- helpers ---------------------------------------------------------------

function noms(...ids: string[]): Nomination[] {
    return ids.map((id, i) => ({ id, restaurantName: id, nominatorName: 'seed', createdAt: i }));
}

function ballots(...rows: string[][]): Vote[] {
    // Each row is one voter's rankings; index = chronological order.
    return rows.map((rankings, i) => ({ voterName: `v${i}`, rankings, createdAt: 1000 * (i + 1) }));
}

// ---- the reported bug ------------------------------------------------------
// Four ballots; Krog is ranked on every one but is *first* on none. Plain IRV
// eliminates Krog in round 1 (zero first-place votes), then breaks the leftover
// 1-1-1-1 tie essentially at random, landing on Surin — a restaurant exactly
// one person ranked. This is the center-squeeze the user reported.

const BUG_NOMS = noms('local', 'krog', 'pho', 'surin', 'dads');
const BUG_VOTES = ballots(
    ['local', 'krog', 'pho'],   // MIKE4
    ['pho', 'krog'],            // MIKE3
    ['surin', 'krog', 'dads'],  // MIKE2
    ['dads', 'local', 'krog'],  // MIKE1
);

test('regression: plain IRV exhibits the reported center-squeeze (picks Surin)', () => {
    const irv = calculateIRV(BUG_NOMS, BUG_VOTES);
    // Krog is eliminated first despite being on every ballot.
    const round1 = irv.rounds[0];
    assert.equal(round1.outcome.type, 'eliminate');
    assert.equal((round1.outcome as { eliminatedId: string }).eliminatedId, 'krog');
    // ...and the tiebroken survivor is Surin, the one-vote candidate.
    assert.equal(irv.winnerId, 'surin');
    assert.equal(irv.tieBroken, true);
});

test('there is no strict Condorcet winner (Krog ties The Local)', () => {
    // The old safety net required a *strict* winner, so it returned null here
    // and the result fell through to IRV's speed tiebreak.
    assert.equal(determineCondorcetWinner(BUG_NOMS, BUG_VOTES), null);
});

test('ranked pairs elects Krog — the never-loses consensus pick', () => {
    const rp = rankedPairs(BUG_NOMS, BUG_VOTES);
    assert.equal(rp.winnerId, 'krog');
    assert.equal(rp.isCondorcetWinner, false); // ties The Local, so not strict
    assert.deepEqual(rp.winnerRecord.beats.sort(), ['dads', 'pho', 'surin']);
    assert.deepEqual(rp.winnerRecord.ties, ['local']);
    assert.deepEqual(rp.winnerRecord.losesTo, []);
});

test('resolveElectionWinner fixes the bug: Krog wins via Ranked Pairs', () => {
    const r = resolveElectionWinner(BUG_NOMS, BUG_VOTES);
    assert.equal(r.winnerId, 'krog');
    assert.equal(r.method, 'Ranked Pairs'); // never-loses, but not a strict Condorcet winner
    assert.equal(r.tieBroken, false); // a unique Ranked Pairs winner stands cleanly
    assert.equal(r.rankedPairs.sources.length, 1);
    assert.equal(r.decidedBySpeed, false);
    // The IRV trace is still produced for the visualization only.
    assert.ok(r.irvRounds.length > 0);
});

// ---- determinism -----------------------------------------------------------

test('ranked pairs is order-independent (ballot input order does not matter)', () => {
    const forward = resolveElectionWinner(BUG_NOMS, BUG_VOTES).winnerId;
    const reversed = resolveElectionWinner(BUG_NOMS, [...BUG_VOTES].reverse()).winnerId;
    assert.equal(forward, 'krog');
    assert.equal(reversed, 'krog');
});

test('Condorcet cycle resolves deterministically (no crash, stable winner)', () => {
    const n = noms('a', 'b', 'c');
    const v = ballots(['a', 'b', 'c'], ['b', 'c', 'a'], ['c', 'a', 'b']); // A>B>C>A
    assert.equal(determineCondorcetWinner(n, v), null); // genuine cycle
    const rp = rankedPairs(n, v);
    assert.equal(rp.isCondorcetWinner, false);
    // Strongest pairwise edge locked first, with the deterministic nomination
    // order breaking the all-equal margins → 'a' tops the ranking.
    assert.equal(rp.winnerId, 'a');
    assert.deepEqual(rp.ranking, ['a', 'b', 'c']);
});

// ---- clean wins still behave as before ------------------------------------

test('a strict Condorcet winner is a clean Condorcet win', () => {
    const n = noms('a', 'b', 'c');
    // 'a' is preferred over both b and c by a majority.
    const v = ballots(['a', 'b', 'c'], ['a', 'c', 'b'], ['b', 'a', 'c']);
    assert.equal(determineCondorcetWinner(n, v), 'a');
    const r = resolveElectionWinner(n, v);
    assert.equal(r.winnerId, 'a');
    assert.equal(r.method, 'Condorcet');
    assert.equal(r.tieBroken, false);
});

// ---- Borda fallback (genuine 3-way tie for first) --------------------------

test('Borda breaks a Ranked Pairs tie of three co-equal front-runners', () => {
    const n = noms('a', 'b', 'c');
    // Every pair ties head-to-head, so all three are Ranked Pairs sources, but
    // their Borda totals differ: a=3, b=3, c=4.
    const v = ballots(['a', 'b'], ['b', 'a'], ['c'], ['c']);
    const rp = rankedPairs(n, v);
    assert.deepEqual(rp.sources.sort(), ['a', 'b', 'c']); // genuine 3-way tie
    const r = resolveElectionWinner(n, v);
    assert.equal(r.method, 'Borda');
    assert.equal(r.winnerId, 'c');
    assert.equal(r.tieBroken, true);
    assert.equal(r.decidedBySpeed, false);
    assert.deepEqual(r.borda!.scores, { a: 3, b: 3, c: 4 });
});

// ---- Speed fallback (perfect tie even after Borda) -------------------------

test('a perfect two-way tie is decided by speed, but reports both options', () => {
    const n = noms('a', 'b');
    // a and b tie pairwise (and therefore tie under Borda); a's only supporter
    // voted first.
    const v = ballots(['a'], ['b']); // v0 (a) at t=1000, v1 (b) at t=2000
    const r = resolveElectionWinner(n, v);
    assert.equal(r.method, 'Speed');
    assert.equal(r.decidedBySpeed, true);
    assert.equal(r.winnerId, 'a');
    assert.deepEqual(r.tiedOptions.sort(), ['a', 'b']); // both shown in the finish
    assert.equal(r.speed!.winnerId, 'a');
    assert.equal(r.speed!.times.a, 1000);
    assert.equal(r.speed!.times.b, 2000);
});

// ---- degenerate inputs -----------------------------------------------------

test('no votes yields no winner', () => {
    const r = resolveElectionWinner(noms('a', 'b'), []);
    assert.equal(r.winnerId, null);
    assert.equal(r.method, undefined);
});

test('single candidate wins outright', () => {
    const r = resolveElectionWinner(noms('a'), ballots(['a'], ['a']));
    assert.equal(r.winnerId, 'a');
});
