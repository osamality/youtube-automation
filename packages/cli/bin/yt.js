#!/usr/bin/env node
// Runs the TypeScript source directly — no build step.
import { register } from "tsx/esm/api";

register();
await import("../src/index.ts");
