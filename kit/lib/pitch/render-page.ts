// The engine's page as `omni pitch render` and `omni pitch studio` serve it (PRD 1108 s6): the two files
// `pnpm kit:build` writes into `kit/dist/pitch-engine/` (s4). A repository that uses the kit carries one
// file, its copy of the bundle, so the bundle carries the page: `kit/build.ts` builds the engine first and
// defines `__OMNI_PITCH_ENGINE__` as its two files' text. From source, the same two files are read from
// `kit/dist/pitch-engine/` itself. Either way they are served from memory: nothing is written beside a run.
//
// The page's contract (s4-01) is written out here, since kit/lib may not import the engine: it reads
// `input.json` beside it or the file `?input=` names, `window.__pitchSeek(n)` settles frame n,
// `window.__pitchInfo()` answers the frame count and each scene's still frame, `?studio` adds the player's
// keys, and `?events=<url>` reloads the page on each message of that event stream.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Defined by `kit/build.ts` in the bundle only: the engine page's files as JSON text. */
declare const __OMNI_PITCH_ENGINE__: string | undefined;

/** The page's two files, by name. */
export const ENGINE_FILES = Object.freeze(['index.html', 'engine.js'] as const);
export type EngineFile = (typeof ENGINE_FILES)[number];
export type EnginePage = Readonly<Record<EngineFile, string>>;

/** The page's input file, as the page names it. */
export const PAGE_INPUT = 'input.json';
/** The page's hook that answers what the video is. */
export const PAGE_INFO = '__pitchInfo';

const EnginePageSchema = z.strictObject({ 'index.html': z.string().min(1), 'engine.js': z.string().min(1) });

/** The built page's folder, when running from source. */
const sourceDir = (): string => fileURLToPath(new URL('../../dist/pitch-engine/', import.meta.url));

/** The two files of a built page in `dir`. */
export function readEnginePage(dir: string = sourceDir()): EnginePage {
  return EnginePageSchema.parse({ 'index.html': readFileSync(join(dir, 'index.html'), 'utf8'), 'engine.js': readFileSync(join(dir, 'engine.js'), 'utf8') });
}

let cached: EnginePage | undefined;

/** The engine page: the bundle's copy, else the built files of this checkout. */
export function enginePage(): EnginePage {
  cached ??= typeof __OMNI_PITCH_ENGINE__ === 'undefined' ? readEnginePage() : EnginePageSchema.parse(JSON.parse(__OMNI_PITCH_ENGINE__));
  return cached;
}
