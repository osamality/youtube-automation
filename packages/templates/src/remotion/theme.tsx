import { loadFont as loadAndika } from "@remotion/google-fonts/Andika";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { createContext, useContext } from "react";
import { type FontName, PALETTES, type Palette } from "../palettes";

export interface Theme {
  palette: Palette;
  fontFamily: string;
  /** Play sound effects (media/sfx/ exists). */
  sfx: boolean;
}

const fallback = PALETTES["dark-blue"] as Palette;
const ThemeContext = createContext<Theme>({
  palette: fallback,
  fontFamily: "sans-serif",
  sfx: false,
});

export const ThemeProvider = ThemeContext.Provider;
export const useTheme = (): Theme => useContext(ThemeContext);

const loaders: Record<FontName, () => { fontFamily: string }> = {
  Inter: () => loadInter("normal", { weights: ["500", "700", "800", "900"], subsets: ["latin"] }),
  Poppins: () =>
    loadPoppins("normal", { weights: ["500", "700", "800", "900"], subsets: ["latin"] }),
  Montserrat: () =>
    loadMontserrat("normal", { weights: ["500", "700", "800", "900"], subsets: ["latin"] }),
  "Space Grotesk": () => loadSpaceGrotesk("normal", { weights: ["500", "700"], subsets: ["latin"] }),
  Nunito: () => loadNunito("normal", { weights: ["600", "700", "800", "900"], subsets: ["latin"] }),
  // For beginning readers: single-storey a and g, as children learn to write them. Only 400 and 700 exist.
  Andika: () => loadAndika("normal", { weights: ["400", "700"], subsets: ["latin"] }),
};

const loaded = new Map<string, string>();

/** Loads the font once per render process and returns its CSS family name. */
export function fontFamilyFor(name: string): string {
  const cached = loaded.get(name);
  if (cached) return cached;
  const loader = loaders[name as FontName] ?? loaders.Inter;
  const family = `${loader().fontFamily}, system-ui, sans-serif`;
  loaded.set(name, family);
  return family;
}

export function paletteFor(name: string): Palette {
  return PALETTES[name] ?? fallback;
}

/** "#RRGGBB" + alpha → "rgba(...)". */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Linear mix of two hex colours. t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  const c = ca.map((v, i) => Math.round(v + ((cb[i] ?? v) - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
