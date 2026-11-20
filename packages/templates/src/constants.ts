/** Frames per second for every render. Voice envelopes are computed at this rate too. */
export const FPS = 30;

export const FORMATS = {
  long: { width: 1920, height: 1080 },
  short: { width: 1080, height: 1920 },
} as const;

export type Format = keyof typeof FORMATS;
