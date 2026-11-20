import type { KokoroTTS } from "kokoro-js";
import type { Channel } from "./config";

type KokoroVoice = NonNullable<NonNullable<Parameters<KokoroTTS["generate"]>[1]>["voice"]>;

const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
let kokoro: Promise<KokoroTTS> | undefined;

/** Text tweaks so the voice reads like a narrator. Captions keep the original text. */
export function speakable(text: string): string {
  return text.replace(/…/g, "...").replace(/\s[—–]\s/g, ", ");
}

/** Writes `text` as speech to `outFile` (WAV). Kokoro runs locally; the model downloads once (~90 MB). */
export async function synthesize(
  text: string,
  voice: Channel["voice"],
  outFile: string,
): Promise<void> {
  if (voice.provider !== "kokoro") {
    throw new Error(
      `Voice provider "${voice.provider}" is not wired up yet (Phase 3). Use provider: kokoro for now.`,
    );
  }
  kokoro ??= import("kokoro-js").then(({ KokoroTTS }) =>
    KokoroTTS.from_pretrained(KOKORO_MODEL, { dtype: "q8", device: "cpu" }),
  );
  const tts = await kokoro;
  const audio = await tts.generate(speakable(text), {
    voice: voice.id as KokoroVoice,
    speed: voice.speed,
  });
  await audio.save(outFile);
}
