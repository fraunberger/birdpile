"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  PARTS,
  PRESETS,
  SYSTEM_INFO,
  type Part,
  type PriceSourceKind,
  type Slot,
  type System,
  type WeightSourceKind,
} from "@/lib/drivetrains/parts";
import {
  SLOTS,
  SLOT_LABEL,
  describeBuild,
  effectiveGrams,
  enumerateBuilds,
  incompatibility,
  lighterSwaps,
  lightestWithin,
  makeBuild,
  paretoFrontier,
  partsFromIds,
  priceOf,
  type Build,
  type BuildFilter,
  type PriceOverrides,
} from "@/lib/drivetrains/builds";
import { shopLinks } from "@/lib/drivetrains/shop";

type Tab = "compare" | "build" | "sources" | "shop";
type BuildIds = Record<Slot, string>;

interface WatchItem {
  partId: string;
  target: number | null;
}

const STORAGE_KEY = "mountain-chickadee:v1";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const grams = (n: number) => `${Math.round(n).toLocaleString("en-US")} g`;

const WEIGHT_KIND: Record<WeightSourceKind, { label: string; className: string; help: string }> = {
  manufacturer: {
    label: "Maker",
    className: "bg-emerald-100 text-emerald-900 border-emerald-300",
    help: "Published on the manufacturer's own site",
  },
  claimed: {
    label: "Claim",
    className: "bg-sky-100 text-sky-900 border-sky-300",
    help: "The manufacturer's claimed weight, reported by the press or a shop",
  },
  retailer: {
    label: "Shop",
    className: "bg-amber-100 text-amber-900 border-amber-300",
    help: "Weight given on a shop listing; the maker publishes none",
  },
  measured: {
    label: "Scale",
    className: "bg-stone-200 text-stone-900 border-stone-400",
    help: "Weighed by an independent reviewer; no maker figure was found",
  },
};

const PRICE_KIND: Record<PriceSourceKind, string> = {
  msrp: "list price",
  retail: "shop price",
  estimate: "estimate",
};

function WeightBadge({ kind }: { kind: WeightSourceKind }) {
  const k = WEIGHT_KIND[kind];
  return (
    <span
      title={k.help}
      className={`inline-block rounded border px-1 py-px text-[10px] font-semibold uppercase tracking-wide ${k.className}`}
    >
      {k.label}
    </span>
  );
}

function partsForSystem(system: System, slot: Slot): Part[] {
  return PARTS.filter((p) => p.system === system && p.slot === slot);
}

function defaultIds(): BuildIds {
  return { ...PRESETS.find((p) => p.id === "xt")!.parts };
}

interface Saved {
  ids: BuildIds;
  overrides: PriceOverrides;
  watch: WatchItem[];
}

function validIds(ids: unknown): ids is BuildIds {
  if (!ids || typeof ids !== "object") return false;
  const rec = ids as Record<string, unknown>;
  return SLOTS.every((slot) => PARTS.some((p) => p.id === rec[slot] && p.slot === slot));
}

/** What this browser saved last time, cleaned of anything that no longer exists. */
function readSaved(): Saved {
  const saved: Saved = { ids: defaultIds(), overrides: {}, watch: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return saved;
    if (validIds(parsed.ids)) saved.ids = parsed.ids;
    if (parsed.overrides && typeof parsed.overrides === "object") {
      for (const [k, v] of Object.entries(parsed.overrides)) {
        if (typeof v === "number" && Number.isFinite(v) && v >= 0 && PARTS.some((p) => p.id === k)) saved.overrides[k] = v;
      }
    }
    if (Array.isArray(parsed.watch)) {
      saved.watch = parsed.watch
        .filter((w: unknown): w is WatchItem => !!w && typeof w === "object" && PARTS.some((p) => p.id === (w as WatchItem).partId))
        .map((w: WatchItem) => ({ partId: w.partId, target: typeof w.target === "number" ? w.target : null }));
    }
  } catch {
    // Private window or blocked storage: start fresh.
  }
  return saved;
}

const noopSubscribe = () => () => {};

export function DrivetrainFinder() {
  // Saved state lives in this browser only, so wait until we're in it.
  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!inBrowser) return <p className="text-sm text-stone-500">Loading drivetrains…</p>;
  return <Finder saved={readSaved()} />;
}

function Finder({ saved }: { saved: Saved }) {
  const [tab, setTab] = useState<Tab>("compare");
  const [filter, setFilter] = useState<Required<BuildFilter>>({
    brand: "any",
    shifting: "any",
    require165: true,
  });
  const [overrides, setOverrides] = useState<PriceOverrides>(saved.overrides);
  const [ids, setIds] = useState<BuildIds>(saved.ids);
  const [watch, setWatch] = useState<WatchItem[]>(saved.watch);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids, overrides, watch }));
    } catch {
      // Private window or blocked storage: the page still works, it just forgets.
    }
  }, [ids, overrides, watch]);

  const builds = useMemo(() => enumerateBuilds(filter, overrides), [filter, overrides]);
  const frontier = useMemo(() => paretoFrontier(builds), [builds]);
  const current = useMemo(() => makeBuild(partsFromIds(ids), overrides), [ids, overrides]);

  const loadBuild = (build: Build) => {
    setIds(Object.fromEntries(SLOTS.map((s) => [s, build.parts[s].id])) as BuildIds);
    setTab("build");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setPrice = (partId: string, value: number | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === null) delete next[partId];
      else next[partId] = value;
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Drivetrain finder</h1>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">
          Shimano and SRAM 1x12, Deore and Eagle 90 up. Each build is a shifter, derailleur, cassette,
          chain and crankset with chainring. Bottom bracket not included. Every weight links to its source,
          and the maker&apos;s own number is used wherever one was published. Cranks are limited to those sold in 165mm.
        </p>
      </header>

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-stone-300" aria-label="Sections">
        {(
          [
            ["compare", "Compare"],
            ["build", "Build"],
            ["sources", "Parts & sources"],
            ["shop", "Shop & deals"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px rounded-t border px-3 py-2 text-sm font-semibold ${
              tab === id ? "border-stone-300 border-b-white bg-white" : "border-transparent text-stone-500 hover:text-black"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {(tab === "compare" || tab === "sources") && <Filters filter={filter} setFilter={setFilter} />}

      {tab === "compare" && (
        <CompareTab builds={builds} frontier={frontier} overrides={overrides} filter={filter} onLoad={loadBuild} />
      )}
      {tab === "build" && (
        <BuildTab
          ids={ids}
          setIds={setIds}
          build={current}
          overrides={overrides}
          setPrice={setPrice}
          onLoad={loadBuild}
          require165={filter.require165}
        />
      )}
      {tab === "sources" && <SourcesTab filter={filter} overrides={overrides} />}
      {tab === "shop" && (
        <ShopTab build={current} overrides={overrides} setPrice={setPrice} watch={watch} setWatch={setWatch} />
      )}

      <footer className="mt-10 border-t border-stone-200 pt-4 text-xs text-stone-500">
        Prices are US list prices where published, otherwise regular shop prices, and they move. Type the price you
        actually find into Build or Shop and every comparison updates. Weights were collected November 2026.
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------ Filters

function Filters({
  filter,
  setFilter,
}: {
  filter: Required<BuildFilter>;
  setFilter: (f: Required<BuildFilter>) => void;
}) {
  const seg = (
    label: string,
    value: string,
    options: [string, string][],
    onChange: (v: string) => void,
  ) => (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-stone-500">{label}</span>
      <div className="inline-flex overflow-hidden rounded border border-stone-300">
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`px-2.5 py-1 text-sm ${value === v ? "bg-black text-white" : "bg-white hover:bg-stone-100"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
      {seg(
        "Brand",
        filter.brand,
        [
          ["any", "Both"],
          ["Shimano", "Shimano"],
          ["SRAM", "SRAM"],
        ],
        (v) => setFilter({ ...filter, brand: v as Required<BuildFilter>["brand"] }),
      )}
      {seg(
        "Shifting",
        filter.shifting,
        [
          ["any", "Any"],
          ["mechanical", "Cable"],
          ["electronic", "Wireless"],
        ],
        (v) => setFilter({ ...filter, shifting: v as Required<BuildFilter>["shifting"] }),
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filter.require165}
          onChange={(e) => setFilter({ ...filter, require165: e.target.checked })}
        />
        165mm cranks only
      </label>
    </div>
  );
}

// ------------------------------------------------------------------ Compare

function presetMatchesFilter(presetBrand: string, electronic: boolean, filter: BuildFilter) {
  if (filter.brand && filter.brand !== "any" && presetBrand !== filter.brand) return false;
  if (filter.shifting === "electronic" && !electronic) return false;
  if (filter.shifting === "mechanical" && electronic) return false;
  return true;
}

/** Thin the frontier to steps that each save a meaningful amount. */
function frontierSteps(frontier: Build[], minSaving = 25): Build[] {
  const out: Build[] = [];
  for (const b of frontier) {
    const last = out[out.length - 1];
    if (!last || last.grams - b.grams >= minSaving) out.push(b);
  }
  const lightest = frontier[frontier.length - 1];
  if (lightest && out[out.length - 1] !== lightest) out.push(lightest);
  return out;
}

function CompareTab({
  builds,
  frontier,
  overrides,
  filter,
  onLoad,
}: {
  builds: Build[];
  frontier: Build[];
  overrides: PriceOverrides;
  filter: BuildFilter;
  onLoad: (b: Build) => void;
}) {
  const presets = useMemo(
    () =>
      PRESETS.filter((p) => presetMatchesFilter(p.brand, p.electronic, filter)).map((p) => ({
        preset: p,
        build: makeBuild(partsFromIds(p.parts), overrides),
      })),
    [filter, overrides],
  );

  const minPrice = frontier[0]?.price ?? 0;
  const maxPrice = frontier[frontier.length - 1]?.price ?? 0;
  const [budget, setBudget] = useState(800);
  const clampedBudget = Math.min(Math.max(budget, Math.ceil(minPrice)), Math.ceil(maxPrice));
  const pick = lightestWithin(builds, clampedBudget);
  const [hover, setHover] = useState<string | null>(null);

  if (builds.length === 0) {
    return <p className="text-sm text-stone-600">No builds match these filters.</p>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded border border-stone-300 p-4">
        <h2 className="text-lg font-bold">Lightest build for your budget</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="range"
            min={Math.floor(minPrice)}
            max={Math.ceil(maxPrice)}
            step={10}
            value={clampedBudget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full max-w-md accent-black"
            aria-label="Budget"
          />
          <span className="text-xl font-bold tabular-nums">{money(clampedBudget)}</span>
        </div>
        {pick && (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-bold tabular-nums">{grams(pick.grams)}</div>
              <div className="text-sm text-stone-600">
                {money(pick.price)} · {pick.parts.shifter.brand} · {describeBuild(pick)}
              </div>
              <ul className="mt-2 text-sm">
                {SLOTS.map((s) => (
                  <li key={s}>
                    <span className="inline-block w-24 text-stone-500">{SLOT_LABEL[s]}</span>
                    {pick.parts[s].name}
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={() => onLoad(pick)} className="rounded bg-black px-3 py-2 text-sm font-semibold text-white">
              Open in Build →
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold">Price vs weight</h2>
        <p className="mb-2 text-sm text-stone-600">
          Each faint dot is one of the {builds.length.toLocaleString()} rideable mixes of parts. The black line is the
          best-value edge: for each build on it, nothing cheaper is lighter. Big dots are the groups as sold.
        </p>
        <Scatter builds={builds} frontier={frontier} presets={presets} hover={hover} setHover={setHover} />
      </section>

      <section>
        <h2 className="text-lg font-bold">Groups as sold</h2>
        <p className="mb-2 text-sm text-stone-600">
          Each group with every part from one level. The last column shows whether mixing levels gets you a lighter build
          for the same money or less, or the same weight for less.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-2">Group</th>
                <th className="py-2 pr-2 text-right">Weight</th>
                <th className="py-2 pr-2 text-right">Price</th>
                <th className="py-2 pr-2">Mixing does better?</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...presets]
                .sort((a, b) => a.build.grams - b.build.grams)
                .map(({ preset, build }) => {
                  const better = lightestWithin(builds, build.price);
                  // A mix "does better" if it's lighter for no more money, or as light for less.
                  const beats =
                    better &&
                    (better.grams < build.grams - 0.5 ||
                      (better.grams <= build.grams + 0.5 && better.price < build.price - 0.5))
                      ? better
                      : null;
                  return (
                    <tr
                      key={preset.id}
                      className={`border-b border-stone-200 ${hover === preset.id ? "bg-stone-100" : ""}`}
                      onMouseEnter={() => setHover(preset.id)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <td className="py-2 pr-2 font-semibold">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                          style={{ background: preset.brand === "SRAM" ? SRAM_COLOR : SHIMANO_COLOR }}
                        />
                        {preset.label}
                        {!preset.electronic && <span className="ml-1 text-xs font-normal text-stone-500">cable</span>}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{grams(build.grams)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{money(build.price)}</td>
                      <td className="py-2 pr-2 text-stone-700">
                        {beats ? (
                          <button className="text-left underline decoration-dotted" onClick={() => onLoad(beats)}>
                            {build.grams - beats.grams >= 0.5
                              ? `${grams(build.grams - beats.grams)} lighter for ${money(build.price - beats.price)} less`
                              : `Same weight for ${money(build.price - beats.price)} less`}
                          </button>
                        ) : (
                          <span className="text-stone-500">No. Already on the best-value edge</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button onClick={() => onLoad(build)} className="text-xs font-semibold underline">
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Best-value edge, step by step</h2>
        <p className="mb-2 text-sm text-stone-600">
          From cheapest to lightest, showing only steps that save at least 25 g. &ldquo;Cost of the step&rdquo; is what
          each step down in weight costs, per 100 g saved.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-2 text-right">Weight</th>
                <th className="py-2 pr-2 text-right">Price</th>
                <th className="py-2 pr-2 text-right">Cost of the step</th>
                <th className="py-2 pr-2">Mix (shifter · derailleur · cassette · chain · crank)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {frontierSteps(frontier).map((b, i, arr) => {
                const prev = arr[i - 1];
                const per100 = prev ? ((b.price - prev.price) / (prev.grams - b.grams)) * 100 : null;
                return (
                  <tr key={i} className="border-b border-stone-200">
                    <td className="py-2 pr-2 text-right tabular-nums font-semibold">{grams(b.grams)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{money(b.price)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-stone-600">
                      {per100 === null ? "n/a" : `${money(per100)} / 100 g`}
                    </td>
                    <td className="py-2 pr-2">
                      <span className="text-stone-500">{b.parts.shifter.brand}</span> {describeBuild(b)}
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => onLoad(b)} className="text-xs font-semibold underline">
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const SRAM_COLOR = "#2a78d6";
const SHIMANO_COLOR = "#eb6834";

function Scatter({
  builds,
  frontier,
  presets,
  hover,
  setHover,
}: {
  builds: Build[];
  frontier: Build[];
  presets: { preset: (typeof PRESETS)[number]; build: Build }[];
  hover: string | null;
  setHover: (id: string | null) => void;
}) {
  const W = 720;
  const H = 380;
  const m = { top: 16, right: 16, bottom: 40, left: 60 };
  const xs = builds.map((b) => b.price);
  const ys = builds.map((b) => b.grams);
  const xMax = Math.ceil(Math.max(...xs) / 250) * 250;
  const yMin = Math.floor((Math.min(...ys) - 20) / 100) * 100;
  const yMax = Math.ceil((Math.max(...ys) + 20) / 100) * 100;
  const x = (v: number) => m.left + (v / xMax) * (W - m.left - m.right);
  const y = (v: number) => m.top + ((yMax - v) / (yMax - yMin)) * (H - m.top - m.bottom);

  const xTicks: number[] = [];
  const xStep = xMax > 2000 ? 500 : 250;
  for (let v = 0; v <= xMax; v += xStep) xTicks.push(v);
  const yTicks: number[] = [];
  const yStep = yMax - yMin > 600 ? 200 : 100;
  for (let v = yMin; v <= yMax; v += yStep) yTicks.push(v);

  const hovered = presets.find((p) => p.preset.id === hover);
  const brands = [...new Set(builds.map((b) => b.parts.shifter.brand))];

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-stone-600">
        {brands.includes("SRAM") && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SRAM_COLOR }} /> SRAM
          </span>
        )}
        {brands.includes("Shimano") && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SHIMANO_COLOR }} /> Shimano
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-black" /> Best-value edge
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Price versus weight of every build">
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} stroke="#e7e5e4" />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#57534e">
              {t.toLocaleString()} g
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={`x${t}`}
            x={x(t)}
            y={H - m.bottom + 18}
            textAnchor={t === xTicks[xTicks.length - 1] ? "end" : "middle"}
            fontSize="11"
            fill="#57534e"
          >
            {money(t)}
          </text>
        ))}
        <text x={(m.left + W - m.right) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#57534e">
          Price
        </text>
        {builds.map((b, i) => (
          <circle
            key={i}
            cx={x(b.price)}
            cy={y(b.grams)}
            r={2}
            fill={b.parts.shifter.brand === "SRAM" ? SRAM_COLOR : SHIMANO_COLOR}
            opacity={0.18}
          />
        ))}
        <polyline
          points={frontier.map((b) => `${x(b.price)},${y(b.grams)}`).join(" ")}
          fill="none"
          stroke="#0b0b0b"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {presets.map(({ preset, build }) => (
          <g
            key={preset.id}
            onMouseEnter={() => setHover(preset.id)}
            onMouseLeave={() => setHover(null)}
            className="cursor-pointer"
          >
            <circle cx={x(build.price)} cy={y(build.grams)} r={14} fill="transparent" />
            <circle
              cx={x(build.price)}
              cy={y(build.grams)}
              r={hover === preset.id ? 8 : 6}
              fill={preset.brand === "SRAM" ? SRAM_COLOR : SHIMANO_COLOR}
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        ))}
        {hovered && (
          <g pointerEvents="none">
            {(() => {
              const px = x(hovered.build.price);
              const py = y(hovered.build.grams);
              const boxW = 210;
              const bx = px + boxW + 16 > W ? px - boxW - 12 : px + 12;
              const by = Math.max(m.top, Math.min(py - 26, H - m.bottom - 52));
              return (
                <>
                  <rect x={bx} y={by} width={boxW} height={48} rx={4} fill="#0b0b0b" opacity={0.92} />
                  <text x={bx + 8} y={by + 19} fontSize="12" fontWeight="bold" fill="#fff">
                    {hovered.preset.label}
                  </text>
                  <text x={bx + 8} y={by + 37} fontSize="12" fill="#e7e5e4">
                    {grams(hovered.build.grams)} · {money(hovered.build.price)}
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </svg>
      <p className="mt-1 text-xs text-stone-500">Point at a big dot, or a row in the table below, to see which group it is.</p>
    </div>
  );
}

// ------------------------------------------------------------------ Build

function PriceInput({
  part,
  overrides,
  setPrice,
}: {
  part: Part;
  overrides: PriceOverrides;
  setPrice: (id: string, v: number | null) => void;
}) {
  const typed = overrides[part.id];
  // Keyed by part id where it's used, so a different part starts fresh.
  const [text, setText] = useState(typed !== undefined ? String(typed) : "");
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-stone-500">$</span>
      <input
        inputMode="decimal"
        value={text}
        placeholder={String(part.price)}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() === "") setPrice(part.id, null);
          else if (Number.isFinite(v) && v >= 0) setPrice(part.id, v);
        }}
        className="w-20 rounded border border-stone-300 px-1.5 py-0.5 text-right tabular-nums"
        aria-label={`Price you found for ${part.name}`}
      />
      {typed !== undefined && (
        <button
          className="text-xs text-stone-500 underline"
          onClick={() => {
            setText("");
            setPrice(part.id, null);
          }}
        >
          reset
        </button>
      )}
    </span>
  );
}

function SourceLine({ part }: { part: Part }) {
  return (
    <div className="space-y-0.5 text-xs text-stone-600">
      <div>
        <WeightBadge kind={part.weightSource.kind} /> {part.grams} g, {part.basis}.{" "}
        <a href={part.weightSource.url} target="_blank" rel="noreferrer" className="underline">
          {part.weightSource.label}
        </a>
      </div>
      {part.adjust && (
        <div>
          {part.adjust.grams > 0 ? "+" : ""}
          {part.adjust.grams} g: {part.adjust.why}
          {part.adjust.source && (
            <>
              {" "}
              <a href={part.adjust.source.url} target="_blank" rel="noreferrer" className="underline">
                {part.adjust.source.label}
              </a>
            </>
          )}
        </div>
      )}
      <div>
        {money(part.price)} {PRICE_KIND[part.priceSource.kind]}
        {part.priceNote ? ` (${part.priceNote})` : ""}:{" "}
        <a href={part.priceSource.url} target="_blank" rel="noreferrer" className="underline">
          {part.priceSource.label}
        </a>
      </div>
      {part.offers165 && (
        <div>
          {part.offers165.ok ? "165mm available" : "No 165mm"}:{" "}
          <a href={part.offers165.url} target="_blank" rel="noreferrer" className="underline">
            {part.offers165.label}
          </a>
        </div>
      )}
      {part.notes && <div className="italic">{part.notes}</div>}
    </div>
  );
}

function BuildTab({
  ids,
  setIds,
  build,
  overrides,
  setPrice,
  onLoad,
  require165,
}: {
  ids: BuildIds;
  setIds: (ids: BuildIds) => void;
  build: Build;
  overrides: PriceOverrides;
  setPrice: (id: string, v: number | null) => void;
  onLoad: (b: Build) => void;
  require165: boolean;
}) {
  const system = build.parts.shifter.system;
  const swaps = useMemo(
    () => lighterSwaps(build, overrides, { require165 }).slice(0, 8),
    [build, overrides, require165],
  );

  const switchSystem = (to: System) => {
    if (to === system) return;
    setIds({ ...PRESETS.find((p) => p.id === (to === "sram-t-type" ? "gx" : "xt"))!.parts });
  };

  const choose = (slot: Slot, id: string) => {
    const next = { ...ids, [slot]: id };
    const parts = partsFromIds(next);
    // Keep shifter and derailleur talking to each other.
    if (parts.shifter.actuation !== parts.derailleur.actuation) {
      const fixSlot: Slot = slot === "shifter" ? "derailleur" : "shifter";
      const want = slot === "shifter" ? parts.shifter.actuation : parts.derailleur.actuation;
      const match = partsForSystem(system, fixSlot).find((p) => p.actuation === want);
      if (match) next[fixSlot] = match.id;
    }
    setIds(next);
  };

  const problem = incompatibility(build.parts);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(SYSTEM_INFO) as System[]).map((s) => (
          <button
            key={s}
            onClick={() => switchSystem(s)}
            className={`rounded border px-3 py-1.5 text-sm ${
              s === system ? "border-black bg-black text-white" : "border-stone-300 hover:bg-stone-100"
            }`}
          >
            {SYSTEM_INFO[s].label}
          </button>
        ))}
      </div>
      <p className="text-sm text-stone-600">
        {SYSTEM_INFO[system].frame} Rear hub needs a {SYSTEM_INFO[system].freehub}.
      </p>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded border border-stone-300 p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-500">Weight</div>
          <div className="text-3xl font-bold tabular-nums">{grams(build.grams)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-500">Price</div>
          <div className="text-3xl font-bold tabular-nums">{money(build.price)}</div>
        </div>
        <div className="text-sm text-stone-600">
          {build.electronic ? "Wireless shifting" : "Cable shifting"} · {describeBuild(build)}
        </div>
        {problem && <div className="w-full text-sm font-semibold text-red-700">{problem}</div>}
      </div>

      <div className="divide-y divide-stone-200 rounded border border-stone-300">
        {SLOTS.map((slot) => {
          const part = build.parts[slot];
          const options = partsForSystem(system, slot);
          return (
            <div key={slot} className="grid gap-2 p-3 md:grid-cols-[110px_1fr_auto]">
              <div className="text-sm font-semibold">{SLOT_LABEL[slot]}</div>
              <div className="min-w-0 space-y-1.5">
                <select
                  value={part.id}
                  onChange={(e) => choose(slot, e.target.value)}
                  className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm"
                >
                  {options.map((p) => {
                    const no165 = slot === "crankset" && require165 && !p.offers165?.ok;
                    return (
                      <option key={p.id} value={p.id} disabled={no165}>
                        {p.tier}: {p.name} ({Math.round(effectiveGrams(p))} g, {money(priceOf(p, overrides))})
                      </option>
                    );
                  })}
                </select>
                <SourceLine part={part} />
              </div>
              <div className="text-right text-sm md:min-w-[150px]">
                <div className="font-semibold tabular-nums">{grams(effectiveGrams(part))}</div>
                <PriceInput key={part.id} part={part} overrides={overrides} setPrice={setPrice} />
              </div>
            </div>
          );
        })}
      </div>

      <section>
        <h2 className="text-lg font-bold">Cheapest ways to drop weight from here</h2>
        <p className="mb-2 text-sm text-stone-600">Single-part swaps, ranked by what each gram saved costs.</p>
        {swaps.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing lighter fits this build.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-2">Swap</th>
                  <th className="py-2 pr-2 text-right">Saves</th>
                  <th className="py-2 pr-2 text-right">Costs</th>
                  <th className="py-2 pr-2 text-right">Per 100 g</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {swaps.map((s) => (
                  <tr key={`${s.slot}-${s.to.id}`} className="border-b border-stone-200">
                    <td className="py-2 pr-2">
                      <span className="text-stone-500">{SLOT_LABEL[s.slot]}:</span> {s.from.tier} → {s.to.tier}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{grams(s.gramsSaved)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {s.extraCost <= 0 ? `saves ${money(-s.extraCost)}` : money(s.extraCost)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {s.extraCost <= 0 ? "free" : money(s.dollarsPerGram * 100)}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        className="text-xs font-semibold underline"
                        onClick={() => onLoad(makeBuild({ ...build.parts, [s.slot]: s.to }, overrides))}
                      >
                        Swap
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ Sources

function SourcesTab({ filter, overrides }: { filter: BuildFilter; overrides: PriceOverrides }) {
  const parts = PARTS.filter((p) => !filter.brand || filter.brand === "any" || p.brand === filter.brand);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 text-xs text-stone-600">
        {(Object.keys(WEIGHT_KIND) as WeightSourceKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <WeightBadge kind={k} /> {WEIGHT_KIND[k].help}
          </span>
        ))}
      </div>
      <p className="text-sm text-stone-600">
        Weights are quoted at different bases. SRAM quotes cranks with chainring and bash guards, Shimano without
        guards. Some derailleurs are quoted with the battery and some without, and chains at different lengths. Where
        that skews a total, the total uses a corrected figure, shown under the part. Crank weights are at the length
        the source used (165mm arms run roughly 5–15 g lighter than 175mm).
      </p>
      {SLOTS.map((slot) => (
        <section key={slot}>
          <h2 className="mb-2 text-lg font-bold">{SLOT_LABEL[slot]}s</h2>
          <div className="divide-y divide-stone-200 rounded border border-stone-300">
            {parts
              .filter((p) => p.slot === slot)
              .sort((a, b) => effectiveGrams(a) - effectiveGrams(b))
              .map((p) => (
                <div key={p.id} className="grid gap-1 p-3 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {p.brand} {p.name} <span className="font-normal text-stone-500">{p.model}</span>
                    </div>
                    <SourceLine part={p} />
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <div className="font-semibold">{grams(effectiveGrams(p))}</div>
                    <div className="text-stone-600">{money(priceOf(p, overrides))}</div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Shop

function ShopTab({
  build,
  overrides,
  setPrice,
  watch,
  setWatch,
}: {
  build: Build;
  overrides: PriceOverrides;
  setPrice: (id: string, v: number | null) => void;
  watch: WatchItem[];
  setWatch: (w: WatchItem[]) => void;
}) {
  const [extra, setExtra] = useState("");
  const watched = new Set(watch.map((w) => w.partId));
  const listIds = [...new Set([...SLOTS.map((s) => build.parts[s].id), ...watch.map((w) => w.partId)])];
  const list = listIds.map((id) => PARTS.find((p) => p.id === id)!).filter(Boolean);

  const toggleWatch = (id: string) =>
    setWatch(watched.has(id) ? watch.filter((w) => w.partId !== id) : [...watch, { partId: id, target: null }]);
  const setTarget = (id: string, target: number | null) =>
    setWatch(watch.map((w) => (w.partId === id ? { ...w, target } : w)));

  const fullListTotal = SLOTS.reduce((sum, s) => sum + build.parts[s].price, 0);

  return (
    <div className="space-y-6">
      <section className="rounded border border-stone-300 bg-stone-50 p-4 text-sm">
        <h2 className="mb-2 text-lg font-bold">Getting a good price</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Black Friday is November 27. Drivetrain parts tend to see their deepest discounts that week, so it&apos;s a good
            time to fill in the prices you find below.
          </li>
          <li>
            &ldquo;OEM&rdquo; or &ldquo;take-off&rdquo; parts on eBay and Pinkbike come off new bikes and often go for well
            under retail. Check that the crank listing says 165mm.
          </li>
          <li>
            Groups bought as a kit are often cheaper than the parts added up. Compare a kit price against the{" "}
            {money(fullListTotal)} reference total for this build.
          </li>
          <li>Cranks: confirm 165mm arms and the chainline your frame needs (Boost 52mm vs 55mm).</li>
          <li>SRAM Transmission needs a UDH frame. Shimano 12-speed needs a Micro Spline freehub.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold">Your build and watch list</h2>
        <p className="mb-2 text-sm text-stone-600">
          Search a shop, then type in the price you found. It replaces the reference price everywhere in this tool, so
          the comparisons use real prices. Star a part and set a target to track it.
        </p>
        <div className="divide-y divide-stone-200 rounded border border-stone-300">
          {list.map((part) => {
            const w = watch.find((x) => x.partId === part.id);
            const found = overrides[part.id];
            const pctOff = found !== undefined ? Math.round((1 - found / part.price) * 100) : null;
            const hitTarget = w?.target != null && found !== undefined && found <= w.target;
            return (
              <div key={part.id} className="space-y-2 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">
                      <button
                        onClick={() => toggleWatch(part.id)}
                        className={`mr-1 ${watched.has(part.id) ? "text-amber-500" : "text-stone-300"}`}
                        aria-label={watched.has(part.id) ? "Stop watching" : "Watch"}
                        title={watched.has(part.id) ? "Stop watching" : "Watch"}
                      >
                        ★
                      </button>
                      {part.brand} {part.name}
                    </div>
                    <div className="text-xs text-stone-500">
                      {part.model} · {SLOT_LABEL[part.slot]} · reference {money(part.price)} ({PRICE_KIND[part.priceSource.kind]})
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-1">
                      <span className="text-xs text-stone-500">Found</span>
                      <PriceInput key={part.id} part={part} overrides={overrides} setPrice={setPrice} />
                    </label>
                    {w && (
                      <label className="flex items-center gap-1">
                        <span className="text-xs text-stone-500">Target $</span>
                        <input
                          inputMode="decimal"
                          value={w.target ?? ""}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setTarget(part.id, e.target.value.trim() === "" || !Number.isFinite(v) ? null : v);
                          }}
                          className="w-20 rounded border border-stone-300 px-1.5 py-0.5 text-right tabular-nums"
                          aria-label={`Target price for ${part.name}`}
                        />
                      </label>
                    )}
                    {pctOff !== null && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                          pctOff >= 30 ? "bg-emerald-100 text-emerald-900" : pctOff > 0 ? "bg-stone-100" : "bg-red-50 text-red-800"
                        }`}
                      >
                        {pctOff > 0 ? `${pctOff}% off` : pctOff === 0 ? "full price" : `${-pctOff}% over`}
                      </span>
                    )}
                    {hitTarget && (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                        Target hit
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {shopLinks(part).map((l) => (
                    <a
                      key={l.shop}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-100"
                    >
                      {l.shop}
                      {l.used ? " (used)" : ""}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-600">Watch another part:</span>
          <select
            value={extra}
            onChange={(e) => {
              setExtra("");
              if (e.target.value && !watched.has(e.target.value)) {
                setWatch([...watch, { partId: e.target.value, target: null }]);
              }
            }}
            className="rounded border border-stone-300 bg-white px-2 py-1"
          >
            <option value="">Choose…</option>
            {PARTS.filter((p) => !listIds.includes(p.id)).map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand} {p.tier}: {p.name}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  );
}
