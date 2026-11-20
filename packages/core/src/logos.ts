import { createRequire } from "node:module";
import type { LogoData } from "@yt/templates/schema";

/**
 * Brand logos from Simple Icons (simpleicons.org, CC0 data; the logos stay their owners' trademarks —
 * fine for commentary, never as our own branding). Plans name them by slug: "nvidia", "intel".
 */

interface SimpleIcon {
  title: string;
  slug: string;
  hex: string;
  path: string;
}

/** Brands Simple Icons doesn't carry: shown as their name on a white tile. */
const TEXT_ONLY: Record<string, string> = {
  openai: "OpenAI",
  microsoft: "Microsoft",
  amazon: "Amazon",
  aws: "AWS",
  tsmc: "TSMC",
  xbox: "Xbox",
  oracle: "Oracle",
  coreweave: "CoreWeave",
  sequoia: "Sequoia",
  nasdaq: "Nasdaq",
  mellanox: "Mellanox",
  ibm: "IBM",
  softbank: "SoftBank",
  marvell: "Marvell",
};

/** Wide wordmarks that shrink to a thin line inside a square tile: shown as their name instead. */
const WORDMARKS: Record<string, string> = {
  samsung: "Samsung",
};

let bySlug: Map<string, SimpleIcon> | undefined;

function icons(): Map<string, SimpleIcon> {
  if (!bySlug) {
    const all = createRequire(import.meta.url)("simple-icons") as Record<string, unknown>;
    bySlug = new Map();
    for (const v of Object.values(all)) {
      const icon = v as Partial<SimpleIcon>;
      if (icon?.slug && icon.path && icon.title) bySlug.set(icon.slug, icon as SimpleIcon);
    }
  }
  return bySlug;
}

/** Every string under a "logo" key anywhere in `value`. */
export function collectLogos(value: unknown, out = new Set<string>()): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectLogos(v, out);
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (key === "logo" && typeof v === "string") out.add(v);
      else collectLogos(v, out);
    }
  }
  return [...out];
}

const titleCase = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);

/** Logo data for each slug, plus the slugs that will show as plain text because nobody knows them. */
export function resolveLogos(slugs: string[]): {
  logos: Record<string, LogoData>;
  unknown: string[];
} {
  const logos: Record<string, LogoData> = {};
  const unknown: string[] = [];
  for (const slug of slugs) {
    const icon = WORDMARKS[slug] ? undefined : icons().get(slug);
    if (WORDMARKS[slug]) {
      logos[slug] = { title: WORDMARKS[slug], hex: null, path: null };
    } else if (icon) {
      logos[slug] = { title: icon.title, hex: `#${icon.hex}`, path: icon.path };
    } else {
      logos[slug] = { title: TEXT_ONLY[slug] ?? titleCase(slug), hex: null, path: null };
      if (!TEXT_ONLY[slug]) unknown.push(slug);
    }
  }
  return { logos, unknown };
}
