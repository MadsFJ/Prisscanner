/**
 * Danish grocery chains we intend to scrape. Each slug must match a scraper implementation
 * once the scanner exists. Verify this list against the current market before relying on it.
 */
export const retailerSeed = [
  { slug: "netto", name: "Netto" },
  { slug: "foetex", name: "føtex" },
  { slug: "bilka", name: "Bilka" },
  { slug: "rema-1000", name: "REMA 1000" },
  { slug: "lidl", name: "Lidl" },
  { slug: "coop-365", name: "Coop 365" },
  { slug: "kvickly", name: "Kvickly" },
  { slug: "superbrugsen", name: "SuperBrugsen" },
  { slug: "meny", name: "MENY" },
  { slug: "spar", name: "SPAR" },
  { slug: "min-koebmand", name: "Min Købmand" },
  { slug: "loevbjerg", name: "Løvbjerg" },
  { slug: "nemlig", name: "nemlig.com" },
] as const;
