import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadBangers } from "@remotion/google-fonts/Bangers";
import { loadFont as loadComicNeue } from "@remotion/google-fonts/ComicNeue";
import { loadFont as loadCourierPrime } from "@remotion/google-fonts/CourierPrime";
import { loadFont as loadKalam } from "@remotion/google-fonts/Kalam";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

/** Extra faces for real-world props: newspaper headlines, typed case files, stamps and thumbnails. */
let serif: string | undefined;
let typed: string | undefined;
let impact: string | undefined;

let hand: string | undefined;

/** Hand lettering for the paper look: signs, labels, speech and the black cards. */
export function handFont(): string {
  hand ??= `${loadKalam("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily}, "Comic Sans MS", cursive`;
  return hand;
}

/** Newspaper headlines and mastheads. */
export function serifFont(): string {
  serif ??= `${loadPlayfair("normal", { weights: ["700", "800", "900"], subsets: ["latin"] }).fontFamily}, Georgia, serif`;
  return serif;
}

/** Typewriter text on case files. */
export function typedFont(): string {
  typed ??= `${loadCourierPrime("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily}, "Courier New", monospace`;
  return typed;
}

let sfx: string | undefined;
let letters: string | undefined;

/** Manga sound-effect words (BOOM, TICK). */
export function sfxFont(): string {
  sfx ??= `${loadBangers("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily}, Impact, sans-serif`;
  return sfx;
}

/** Manga lettering: speech bubbles and narration boxes. */
export function letterFont(): string {
  letters ??= `${loadComicNeue("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily}, "Comic Sans MS", sans-serif`;
  return letters;
}

/** Tall condensed capitals for stamps and thumbnail words. */
export function impactFont(): string {
  impact ??= `${loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily}, Impact, sans-serif`;
  return impact;
}
