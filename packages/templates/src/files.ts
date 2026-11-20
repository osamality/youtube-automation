import path from "node:path";
import { fileURLToPath } from "node:url";

/** Node-only: where the templates package keeps its bundled files. */
const here = path.dirname(fileURLToPath(import.meta.url));

/** Synthesised sound effects (scripts/make-sfx.sh). Copied into each video's media/sfx/. */
export const SFX_DIR = path.resolve(here, "..", "sfx");
