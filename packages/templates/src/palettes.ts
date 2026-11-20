/** Colour sets a channel can pick with theme.palette. Pure data — safe to import from Node. */
export interface Palette {
  dark: boolean;
  bg: string;
  bg2: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  positive: string;
  negative: string;
  /** Bright palettes: one background per scene (cycled) and the colours used for shapes and stickers. */
  scenes?: string[];
  pops?: string[];
  /** Thumbnail colours. Thumbnails need a strong background, so light palettes set their own. */
  thumb?: { bg: string; glow: string; highlight: string };
}

export const PALETTES: Record<string, Palette> = {
  "dark-blue": {
    dark: true,
    bg: "#090E1D",
    bg2: "#121B3A",
    surface: "#16214A",
    surface2: "#22305F",
    text: "#F5F7FF",
    muted: "#9AA6C9",
    accent: "#4D8DFF",
    accent2: "#FFC14D",
    positive: "#34D399",
    negative: "#FB7185",
  },
  "midnight-purple": {
    dark: true,
    bg: "#0E0A1E",
    bg2: "#1C1240",
    surface: "#241852",
    surface2: "#302168",
    text: "#F7F3FF",
    muted: "#AA9ECB",
    accent: "#A78BFA",
    accent2: "#F472B6",
    positive: "#34D399",
    negative: "#FB7185",
  },
  forest: {
    dark: true,
    bg: "#07130E",
    bg2: "#0E2A1E",
    surface: "#133325",
    surface2: "#1B4433",
    text: "#F1FBF5",
    muted: "#90B6A3",
    accent: "#34D399",
    accent2: "#FBBF24",
    positive: "#34D399",
    negative: "#F87171",
  },
  sunrise: {
    dark: false,
    bg: "#FFF6EC",
    bg2: "#FFE9D6",
    surface: "#FFFFFF",
    surface2: "#FFF1E3",
    text: "#1D2140",
    muted: "#6B6F8A",
    accent: "#F2542D",
    accent2: "#FFC23C",
    positive: "#14A37F",
    negative: "#E5484D",
    scenes: ["#FFF6EC", "#E6F6F2", "#FFEEF2", "#EAF0FF", "#FFF7D6", "#F1EBFF"],
    pops: ["#F2542D", "#22B5A5", "#FFC23C", "#4C7DFF", "#A66CFF"],
  },
  /** Dark but colourful: each scene gets its own deep hue, with bright shapes and glows. */
  "neon-night": {
    dark: true,
    bg: "#0D1024",
    bg2: "#151A3A",
    surface: "#1A2047",
    surface2: "#252C5C",
    text: "#F4F6FF",
    muted: "#A2A9D0",
    accent: "#6C5CFF",
    accent2: "#FFC23C",
    positive: "#2EE6A6",
    negative: "#FF5C7A",
    scenes: ["#0D1024", "#0B1E2D", "#1A1030", "#0E1A3A", "#1B1326", "#0B2224"],
    pops: ["#FF5C8A", "#2EE6A6", "#FFC23C", "#4C9BFF", "#B06CFF"],
  },
  /** Bright and clean, for adult explainers: light scene colours, orange-red and blue accents, no purple. */
  daylight: {
    dark: false,
    bg: "#F7F9FC",
    bg2: "#EAF0F8",
    surface: "#FFFFFF",
    surface2: "#F0F4FA",
    text: "#14182B",
    muted: "#5C6378",
    accent: "#F2541B",
    accent2: "#1971C2",
    positive: "#0CA678",
    negative: "#E03131",
    scenes: ["#FFF3E8", "#E5F1FC", "#E6F7EF", "#FFF7D1", "#FCEBEB", "#E9F5F7"],
    pops: ["#F2541B", "#1C8BF2", "#12B886", "#FFB300", "#F03E66"],
    // Thumbnails are dark and dramatic (Paper Billions style, 11/11/2026); the number goes red.
    thumb: { bg: "#110E16", glow: "#B0201B", highlight: "#FF3B30" },
  },
  "warm-cream": {
    dark: false,
    bg: "#FBF6EE",
    bg2: "#F1E5D1",
    surface: "#FFFFFF",
    surface2: "#F4EBDD",
    text: "#1F1A14",
    muted: "#776B5B",
    accent: "#E8590C",
    accent2: "#1C7ED6",
    positive: "#2F9E44",
    negative: "#E03131",
  },
};

/** Google Fonts the templates can load with theme.font. */
export const FONTS = [
  "Inter",
  "Poppins",
  "Montserrat",
  "Space Grotesk",
  "Nunito",
  "Andika",
] as const;
export type FontName = (typeof FONTS)[number];
