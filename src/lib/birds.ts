export const BIRD_CATALOG = [
  { slug: "american_robin", filename: "american_robin.jpeg" },
  { slug: "australian_magpie", filename: "australian_magpie.png" },
  { slug: "australian_pied_cormorant", filename: "australian_pied_cormorant.png" },
  { slug: "black_throated_sparrow", filename: "black_throated_sparrow.jpeg" },
  { slug: "black_billed_gull", filename: "black_billed_gull.png" },
  { slug: "brown_thrasher", filename: "brown_thrasher.jpeg" },
  { slug: "california_quail", filename: "california_quail.png" },
  { slug: "california_scrub_jay", filename: "california_scrub_jay.jpeg" },
  { slug: "cardinal", filename: "cardinal.png" },
  { slug: "carolina_wren", filename: "carolina_wren.jpeg" },
  { slug: "cedar_waxwing", filename: "cedar_waxwing.jpeg" },
  { slug: "chaffinch", filename: "chaffinch.png" },
  { slug: "coot", filename: "coot.png" },
  { slug: "curve_bill_thrasher", filename: "curve_bill_thrasher.jpeg" },
  { slug: "dark_eyed_junco", filename: "dark_eyed_junco.jpeg" },
  { slug: "downy_woodpecker", filename: "downy_woodpecker.jpeg" },
  { slug: "eastern_bluebird", filename: "eastern_bluebird.jpeg" },
  { slug: "european_greenfinch", filename: "european_greenfinch.png" },
  { slug: "european_herring_gull", filename: "european_herring_gull.jpeg" },
  { slug: "gila_woodpecker", filename: "gila_woodpecker.jpeg" },
  { slug: "great_blue_heron", filename: "great_blue_heron.png" },
  { slug: "house_finch", filename: "house_finch.jpeg" },
  { slug: "house_sparrow", filename: "house_sparrow.png" },
  { slug: "kaka", filename: "kaka.png" },
  { slug: "killdeer", filename: "killdeer.jpeg" },
  { slug: "muscovy_duck", filename: "muscovy_duck.jpeg" },
  { slug: "new_zealand_bellbird", filename: "new_zealand_bellbird.png" },
  { slug: "new_zealand_pigeon", filename: "new_zealand_pigeon.png" },
  { slug: "northern_mockingbird", filename: "northern_mockingbird.png" },
  { slug: "pileated_woodpecker", filename: "pileated_woodpecker.png" },
  { slug: "red_bellied_woodpecker", filename: "red_bellied_woodpecker.jpeg" },
  { slug: "says_pheobe", filename: "says_pheobe.jpeg" },
  { slug: "silver_gull", filename: "silver_gull.png" },
  { slug: "spotted_shag", filename: "spotted_shag.png" },
  { slug: "stellars_jay", filename: "stellars_jay.jpeg" },
  { slug: "takahe", filename: "takahe.png" },
  { slug: "tufted_titmouse", filename: "tufted_titmouse.jpeg" },
  { slug: "vermillion_flycatcher", filename: "vermillion_flycatcher.jpeg" },
  { slug: "yellowhammer", filename: "yellowhammer.png" },
] as const;

export const APP_CATALOG = [
  {
    slug: "australian_magpie",
    filename: "australian_magpie.png",
    title: "Bill Splitter",
  },
  {
    slug: "pileated_woodpecker",
    filename: "pileated_woodpecker.png",
    title: "Election App",
  },
  {
    slug: "eastern_bluebird",
    filename: "eastern_bluebird.jpeg",
    title: "Blackjack Trainer",
  },
] as const;

export type BirdSlug = (typeof BIRD_CATALOG)[number]["slug"];
export type AppSlug = (typeof APP_CATALOG)[number]["slug"];

export const BIRD_FILENAME_BY_SLUG: Record<BirdSlug, string> = BIRD_CATALOG.reduce(
  (acc, bird) => {
    acc[bird.slug] = bird.filename;
    return acc;
  },
  {} as Record<BirdSlug, string>
);
