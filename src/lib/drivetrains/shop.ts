import type { Part } from "./parts";

export interface ShopLink {
  shop: string;
  url: string;
  used?: boolean;
}

const SHOPS: { shop: string; search: (q: string) => string; used?: boolean }[] = [
  { shop: "Google Shopping", search: (q) => `https://www.google.com/search?tbm=shop&q=${q}` },
  { shop: "Jenson USA", search: (q) => `https://www.jensonusa.com/search?q=${q}` },
  { shop: "Competitive Cyclist", search: (q) => `https://www.competitivecyclist.com/Store/catalog/search.jsp?q=${q}` },
  { shop: "REI", search: (q) => `https://www.rei.com/search?q=${q}` },
  { shop: "Worldwide Cyclery", search: (q) => `https://www.worldwidecyclery.com/search?q=${q}` },
  { shop: "Bike24", search: (q) => `https://www.bike24.com/search-result?searchTerm=${q}` },
  { shop: "Amazon", search: (q) => `https://www.amazon.com/s?k=${q}` },
  { shop: "eBay", search: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}` },
  { shop: "Pinkbike", search: (q) => `https://www.pinkbike.com/buysell/list/?q=${q}`, used: true },
];

/** What to type into a shop's search box for this part. */
export function searchQuery(part: Part): string {
  const name = part.name.replace(/\s*\(.*?\)\s*/g, " ").replace(/,.*$/, "").trim();
  const base = part.brand === "Shimano" ? `Shimano ${part.model.split(" ")[0]} ${name}` : `SRAM ${name}`;
  return part.slot === "crankset" ? `${base} 165mm` : base;
}

export function shopLinks(part: Part): ShopLink[] {
  const q = encodeURIComponent(searchQuery(part));
  return SHOPS.map((s) => ({ shop: s.shop, url: s.search(q), used: s.used }));
}
