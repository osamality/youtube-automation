import { Html5Audio, Sequence, staticFile } from "remotion";
import { useTheme } from "./theme";

const LENGTH = { pop: 6, whoosh: 16, ding: 30, notify: 12, click: 3, boom: 18, sparkle: 24 } as const;
export type SfxName = keyof typeof LENGTH;

const LEVEL: Record<SfxName, number> = {
  pop: 0.45,
  whoosh: 0.28,
  ding: 0.35,
  notify: 0.4,
  click: 0.3,
  boom: 0.5,
  sparkle: 0.3,
};

/** One sound effect at a frame of the enclosing scene. Silent when the channel turns effects off. */
export const Sfx: React.FC<{ at: number; name: SfxName; volume?: number }> = ({
  at,
  name,
  volume,
}) => {
  const { sfx } = useTheme();
  if (!sfx || !Number.isFinite(at)) return null;
  return (
    <Sequence from={Math.max(0, Math.round(at))} durationInFrames={LENGTH[name] + 2} layout="none">
      <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={(volume ?? 1) * LEVEL[name]} />
    </Sequence>
  );
};
