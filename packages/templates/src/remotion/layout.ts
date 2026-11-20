import { useVideoConfig } from "remotion";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Layout {
  width: number;
  height: number;
  portrait: boolean;
  /** 1% of the short side — 10.8 px in both 1920×1080 and 1080×1920. All sizes are in u. */
  u: number;
  /** Where scene content goes. Leaves room for captions, the mascot and (in Shorts) YouTube's own UI. */
  content: Box;
  /** Vertical centre line of the caption band. */
  captionsY: number;
}

export function useLayout(): Layout {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const u = Math.min(width, height) / 100;
  const content: Box = portrait
    ? { left: 7 * u, top: height * 0.1, width: width - 14 * u, height: height * 0.49 }
    : { left: 7 * u, top: height * 0.1, width: width - 14 * u, height: height * 0.64 };
  return {
    width,
    height,
    portrait,
    u,
    content,
    captionsY: portrait ? height * 0.655 : height * 0.865,
  };
}

/** Scales a font down for long text so it still fits. */
export function fitFont(text: string, base: number, comfortableChars: number, min = 0.55): number {
  const ratio = Math.sqrt(comfortableChars / Math.max(text.length, 1));
  return base * Math.min(1, Math.max(min, ratio));
}
