import type { Word } from "./schema";

/**
 * Estimates when each word is spoken, spreading the narration across the voiced part of the audio.
 * Good to within a few hundred milliseconds on short scenes. Phase 3 replaces this with whisper.cpp timings.
 */
export function estimateWordTimings(text: string, voicedStart: number, voicedEnd: number): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length || voicedEnd <= voicedStart) return [];

  const units = tokens.map((token) => ({
    token,
    speak: spokenWeight(token),
    pause: /[.!?]["')\]]*$/.test(token) ? 1.6 : /[,;:—–]["')\]]*$/.test(token) ? 0.8 : 0,
  }));
  // The final pause is not spoken inside the voiced range.
  const last = units[units.length - 1];
  if (last) last.pause = 0;

  const total = units.reduce((sum, u) => sum + u.speak + u.pause, 0);
  const perUnit = (voicedEnd - voicedStart) / total;

  let t = voicedStart;
  return units.map((u) => {
    const start = t;
    const end = start + u.speak * perUnit;
    t = end + u.pause * perUnit;
    return { text: u.token, start: round(start), end: round(end) };
  });
}

/** Rough syllable count. Digits are read out ("2024" → "twenty twenty-four"). */
function spokenWeight(token: string): number {
  const digits = token.replace(/[^0-9]/g, "").length;
  if (digits) return Math.max(1, digits * 1.25);
  const groups = token.toLowerCase().match(/[aeiouy]+/g)?.length ?? 1;
  const silentE = /[^aeiouy]e$/i.test(token.replace(/[^a-z]/gi, "")) && groups > 1 ? 1 : 0;
  return Math.max(1, groups - silentE) + 0.35;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
