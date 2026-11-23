import { PARTS, type Part, type Slot } from "./parts";

export const SLOTS: Slot[] = ["shifter", "derailleur", "cassette", "chain", "crankset"];

export const SLOT_LABEL: Record<Slot, string> = {
  shifter: "Shifter",
  derailleur: "Derailleur",
  cassette: "Cassette",
  chain: "Chain",
  crankset: "Crankset",
};

// Prices the user has typed in, by part id. They replace the reference price.
export type PriceOverrides = Record<string, number>;

export type BuildParts = Record<Slot, Part>;

export interface Build {
  parts: BuildParts;
  grams: number;
  price: number;
  electronic: boolean;
}

export interface BuildFilter {
  brand?: "SRAM" | "Shimano" | "any";
  shifting?: "electronic" | "mechanical" | "any";
  require165?: boolean;
}

/** The weight a total uses: the stated figure plus any basis correction. */
export function effectiveGrams(part: Part): number {
  return part.grams + (part.adjust?.grams ?? 0);
}

export function priceOf(part: Part, overrides: PriceOverrides = {}): number {
  const typed = overrides[part.id];
  return typeof typed === "number" && Number.isFinite(typed) && typed >= 0 ? typed : part.price;
}

export function isElectronic(part: Part): boolean {
  return part.actuation === "sram-axs" || part.actuation === "shimano-di2";
}

/** Why a set of parts can't be ridden together, or null if it can. */
export function incompatibility(parts: BuildParts): string | null {
  const systems = new Set(SLOTS.map((slot) => parts[slot].system));
  if (systems.size > 1) return "SRAM and Shimano parts don't mix here.";
  for (const slot of SLOTS) {
    if (parts[slot].slot !== slot) return `${parts[slot].name} isn't a ${SLOT_LABEL[slot].toLowerCase()}.`;
  }
  if (parts.shifter.actuation !== parts.derailleur.actuation) {
    return `The ${parts.shifter.name} can't shift the ${parts.derailleur.name}.`;
  }
  return null;
}

export function makeBuild(parts: BuildParts, overrides: PriceOverrides = {}): Build {
  let grams = 0;
  let price = 0;
  for (const slot of SLOTS) {
    grams += effectiveGrams(parts[slot]);
    price += priceOf(parts[slot], overrides);
  }
  return { parts, grams, price, electronic: isElectronic(parts.derailleur) };
}

export function partById(id: string, parts: Part[] = PARTS): Part {
  const part = parts.find((p) => p.id === id);
  if (!part) throw new Error(`Unknown part: ${id}`);
  return part;
}

export function partsFromIds(ids: Record<Slot, string>, parts: Part[] = PARTS): BuildParts {
  return {
    shifter: partById(ids.shifter, parts),
    derailleur: partById(ids.derailleur, parts),
    cassette: partById(ids.cassette, parts),
    chain: partById(ids.chain, parts),
    crankset: partById(ids.crankset, parts),
  };
}

function passesPartFilter(part: Part, filter: BuildFilter): boolean {
  if (filter.brand && filter.brand !== "any" && part.brand !== filter.brand) return false;
  if (filter.require165 && part.slot === "crankset" && !part.offers165?.ok) return false;
  return true;
}

/** Every rideable mix of parts that passes the filter. */
export function enumerateBuilds(
  filter: BuildFilter = {},
  overrides: PriceOverrides = {},
  parts: Part[] = PARTS,
): Build[] {
  const bySlot = Object.fromEntries(
    SLOTS.map((slot) => [slot, parts.filter((p) => p.slot === slot && passesPartFilter(p, filter))]),
  ) as Record<Slot, Part[]>;

  const builds: Build[] = [];
  for (const shifter of bySlot.shifter) {
    for (const derailleur of bySlot.derailleur) {
      if (derailleur.system !== shifter.system || derailleur.actuation !== shifter.actuation) continue;
      const electronic = isElectronic(derailleur);
      if (filter.shifting === "electronic" && !electronic) continue;
      if (filter.shifting === "mechanical" && electronic) continue;
      for (const cassette of bySlot.cassette) {
        if (cassette.system !== shifter.system) continue;
        for (const chain of bySlot.chain) {
          if (chain.system !== shifter.system) continue;
          for (const crankset of bySlot.crankset) {
            if (crankset.system !== shifter.system) continue;
            builds.push(makeBuild({ shifter, derailleur, cassette, chain, crankset }, overrides));
          }
        }
      }
    }
  }
  return builds;
}

/**
 * The builds nothing beats on both counts: for each one, every cheaper build
 * is heavier. Ordered cheapest (heaviest) to dearest (lightest).
 */
export function paretoFrontier(builds: Build[]): Build[] {
  const sorted = [...builds].sort((a, b) => a.price - b.price || a.grams - b.grams);
  const frontier: Build[] = [];
  let lightest = Infinity;
  for (const build of sorted) {
    if (build.grams < lightest) {
      frontier.push(build);
      lightest = build.grams;
    }
  }
  return frontier;
}

export function lightestWithin(builds: Build[], budget: number): Build | null {
  let best: Build | null = null;
  for (const b of builds) {
    if (b.price > budget) continue;
    if (!best || b.grams < best.grams || (b.grams === best.grams && b.price < best.price)) best = b;
  }
  return best;
}

export interface Swap {
  slot: Slot;
  from: Part;
  to: Part;
  gramsSaved: number;
  extraCost: number;
  dollarsPerGram: number; // extra cost per gram saved; 0 or less means free or cheaper
}

/**
 * Single-part swaps that make a build lighter, best value first: the ones that
 * save weight and money come first, then the lowest dollars per gram.
 */
export function lighterSwaps(build: Build, overrides: PriceOverrides = {}, filter: BuildFilter = {}, parts: Part[] = PARTS): Swap[] {
  const swaps: Swap[] = [];
  for (const slot of SLOTS) {
    const from = build.parts[slot];
    for (const to of parts) {
      if (to.slot !== slot || to.id === from.id || !passesPartFilter(to, filter)) continue;
      const next = { ...build.parts, [slot]: to } as BuildParts;
      if (incompatibility(next)) continue;
      const gramsSaved = effectiveGrams(from) - effectiveGrams(to);
      if (gramsSaved <= 0) continue;
      const extraCost = priceOf(to, overrides) - priceOf(from, overrides);
      swaps.push({ slot, from, to, gramsSaved, extraCost, dollarsPerGram: extraCost / gramsSaved });
    }
  }
  return swaps.sort((a, b) => a.dollarsPerGram - b.dollarsPerGram || b.gramsSaved - a.gramsSaved);
}

export function describeBuild(build: Build): string {
  const tiers = SLOTS.map((slot) => build.parts[slot].tier);
  const unique = [...new Set(tiers)];
  return unique.length === 1 ? `All ${unique[0]}` : SLOTS.map((s) => `${build.parts[s].tier}`).join(" · ");
}
