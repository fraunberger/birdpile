import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PARTS, PRESETS } from './parts';
import {
    SLOTS,
    effectiveGrams,
    enumerateBuilds,
    incompatibility,
    lighterSwaps,
    lightestWithin,
    makeBuild,
    paretoFrontier,
    partsFromIds,
    priceOf,
} from './builds';

test('every part has a sourced weight and price', () => {
    const ids = new Set<string>();
    for (const part of PARTS) {
        assert.ok(!ids.has(part.id), `duplicate id ${part.id}`);
        ids.add(part.id);
        assert.ok(part.grams > 0, part.id);
        assert.ok(part.price > 0, part.id);
        assert.match(part.weightSource.url, /^https:\/\//, part.id);
        assert.match(part.priceSource.url, /^https:\/\//, part.id);
        if (part.slot === 'shifter' || part.slot === 'derailleur') assert.ok(part.actuation, part.id);
        if (part.slot === 'crankset') assert.ok(part.offers165, part.id);
    }
});

test('SRAM weights come from sram.com', () => {
    for (const part of PARTS.filter((p) => p.brand === 'SRAM')) {
        assert.equal(part.weightSource.kind, 'manufacturer', part.id);
        assert.match(part.weightSource.url, /^https:\/\/www\.sram\.com\//, part.id);
    }
});

test('every preset is a rideable build', () => {
    for (const preset of PRESETS) {
        const parts = partsFromIds(preset.parts);
        assert.equal(incompatibility(parts), null, preset.id);
        assert.equal(makeBuild(parts).electronic, preset.electronic, preset.id);
    }
});

test('basis corrections are applied to totals', () => {
    const gx = PARTS.find((p) => p.id === 'sram-rd-gx')!;
    assert.equal(effectiveGrams(gx), 495);
    const chain = PARTS.find((p) => p.id === 'sram-cn-gx')!;
    assert.equal(effectiveGrams(chain), 258);
});

test('a mechanical shifter cannot run an electronic derailleur', () => {
    const parts = partsFromIds({ ...PRESETS.find((p) => p.id === 'xt')!.parts, derailleur: 'shi-rd-m8250' });
    assert.match(incompatibility(parts) ?? '', /can't shift/);
    const mixed = partsFromIds({ ...PRESETS.find((p) => p.id === 'xt')!.parts, chain: 'sram-cn-gx' });
    assert.match(incompatibility(mixed) ?? '', /don't mix/);
});

test('enumeration only yields compatible builds and honors filters', () => {
    const all = enumerateBuilds({ require165: true });
    assert.ok(all.length > 100);
    for (const b of all) assert.equal(incompatibility(b.parts), null);
    const sramElectronic = enumerateBuilds({ brand: 'SRAM', shifting: 'electronic' });
    assert.ok(sramElectronic.every((b) => b.electronic && b.parts.chain.brand === 'SRAM'));
    // Every preset is somewhere in the full set.
    for (const preset of PRESETS) {
        assert.ok(all.some((b) => SLOTS.every((s) => b.parts[s].id === preset.parts[s])), preset.id);
    }
});

test('the frontier gets lighter as it gets dearer, and nothing beats it', () => {
    const all = enumerateBuilds();
    const frontier = paretoFrontier(all);
    for (let i = 1; i < frontier.length; i++) {
        assert.ok(frontier[i].price >= frontier[i - 1].price);
        assert.ok(frontier[i].grams < frontier[i - 1].grams);
    }
    for (const point of frontier) {
        assert.ok(!all.some((b) => b.price <= point.price && b.grams < point.grams));
    }
    const budget = lightestWithin(all, 1000)!;
    assert.ok(budget.price <= 1000);
    assert.ok(!all.some((b) => b.price <= 1000 && b.grams < budget.grams));
});

test('typed prices replace reference prices', () => {
    const part = PARTS[0];
    assert.equal(priceOf(part, { [part.id]: 12 }), 12);
    assert.equal(priceOf(part, { [part.id]: Number.NaN }), part.price);
    const cheap = enumerateBuilds({}, { 'shi-fc-m9100': 1 });
    assert.ok(paretoFrontier(cheap).some((b) => b.parts.crankset.id === 'shi-fc-m9100'));
});

test('swaps only offer lighter, compatible parts, best value first', () => {
    const build = makeBuild(partsFromIds(PRESETS.find((p) => p.id === 'slx')!.parts));
    const swaps = lighterSwaps(build);
    assert.ok(swaps.length > 0);
    for (let i = 0; i < swaps.length; i++) {
        assert.ok(swaps[i].gramsSaved > 0);
        assert.equal(swaps[i].to.brand, 'Shimano');
        if (i > 0) assert.ok(swaps[i].dollarsPerGram >= swaps[i - 1].dollarsPerGram);
    }
});
