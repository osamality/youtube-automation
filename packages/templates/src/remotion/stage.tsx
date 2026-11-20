import { createContext, useContext } from "react";
import { CAST, type CastMember } from "../cast";
import type { ArtSource, CastLook, LogoData, PhotoData } from "../schema";

/** What the plan brings beyond the channel theme: its own characters and the logos it names. */
export interface Stage {
  cast: Record<string, CastMember>;
  logos: Record<string, LogoData>;
  photos: Record<string, PhotoData>;
  art: Record<string, ArtSource>;
}

const StageContext = createContext<Stage>({ cast: CAST, logos: {}, photos: {}, art: {} });

export const StageProvider = StageContext.Provider;

export function makeStage(
  planCast: CastLook[] | undefined,
  logos: Record<string, LogoData>,
  photos: Record<string, PhotoData> = {},
  planArt: ArtSource[] = [],
): Stage {
  const cast: Record<string, CastMember> = { ...CAST };
  for (const { id, ...look } of planCast ?? []) cast[id] = look;
  return { cast, logos, photos, art: Object.fromEntries(planArt.map((a) => [a.id, a])) };
}

const FALLBACK: CastMember = CAST.dev;

export function useStage(): Stage {
  return useContext(StageContext);
}

export function useCastMember(who: string): CastMember {
  return useContext(StageContext).cast[who] ?? FALLBACK;
}

export function useLogo(slug: string): LogoData {
  return useContext(StageContext).logos[slug] ?? { title: slug, hex: null, path: null };
}

/** A photo from plan.photos, or null when it wasn't downloaded (the scene then draws a placeholder). */
export function usePhoto(id: string | undefined): PhotoData | null {
  const photos = useContext(StageContext).photos;
  return id ? (photos[id] ?? null) : null;
}
