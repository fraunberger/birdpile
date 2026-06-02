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
    assert.equal(r.method, 'Ranked Pairs');
    assert.equal(r.tieBroken, true);
    // The IRV trace is still produced for the visualization.
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

test('a strict Condorcet winner is reported as a clean Condorcet win', () => {
    const n = noms('a', 'b', 'c');
    // 'a' is preferred over both b and c by a majority.
    const v = ballots(['a', 'b', 'c'], ['a', 'c', 'b'], ['b', 'a', 'c']);
    assert.equal(determineCondorcetWinner(n, v), 'a');
    const r = resolveElectionWinner(n, v);
    assert.equal(r.winnerId, 'a');
    assert.equal(r.tieBroken, false);
    // IRV agrees here (a has a first-place majority), so the cascade labels it IRV.
    assert.ok(r.method === 'Instant Runoff' || r.method === 'Condorcet');
});

test('a clean first-place majority wins by Instant Runoff with no tiebreak', () => {
    const n = noms('a', 'b', 'c');
    const v = ballots(['a'], ['a'], ['b'], ['c']); // a has 2 of 4... not majority
    // Make it a true majority: 3 of 5.
    const v2 = ballots(['a'], ['a'], ['a'], ['b'], ['c']);
    const r = resolveElectionWinner(n, v2);
    assert.equal(r.winnerId, 'a');
    assert.equal(r.method, 'Instant Runoff');
    assert.equal(r.tieBroken, false);
    assert.equal(calculateIRV(n, v).rounds.length > 0, true);
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
