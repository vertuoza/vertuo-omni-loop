// The registry of a pitch's providers (PRD 1108's spec, "Providers"): the one place, beside each
// provider's own file, that names a provider. Adding one is its file and its line below; removing one is
// deleting both. A setting that names a provider no longer registered falls back to its kind's default
// with one line, and a music track or a font that cannot be had falls back the same way.
import { messageOf } from '../../narrow.ts';
import { playwrightCapture } from './capture/playwright.ts';
import { ffmpegEncode } from './encode/ffmpeg.ts';
import { fileFonts } from './fonts/file.ts';
import { googleFonts } from './fonts/google-fonts.ts';
import { systemFonts } from './fonts/system.ts';
import { fileMusic } from './music/file.ts';
import { freepdMusic } from './music/freepd.ts';
import { noneMusic } from './music/none.ts';
import type { FontRequest, FontsContext, Kind, LoadedFont, MusicContext, MusicRequest, ProviderOf, Track } from './types.ts';

/** Every registered provider, by kind. */
export type Registry = { readonly [K in Kind]: readonly ProviderOf[K][] };

export const REGISTRY: Registry = Object.freeze({
  music: [noneMusic, freepdMusic, fileMusic],
  fonts: [systemFonts, googleFonts, fileFonts],
  capture: [playwrightCapture],
  encode: [ffmpegEncode],
});

/** Each kind's default, the provider a missing or failing one falls back to. */
export const DEFAULTS: Readonly<Record<Kind, string>> = Object.freeze({ music: 'none', fonts: 'system', capture: 'playwright', encode: 'ffmpeg' });

/** Where a fallback's one line goes. */
export type Warn = (line: string) => void;

function defaultOf<K extends Kind>(kind: K, registry: Registry): ProviderOf[K] {
  const fallback = registry[kind].find((provider) => provider.id === DEFAULTS[kind]);
  if (fallback === undefined) throw new Error(`no ${kind} provider to fall back to: ${DEFAULTS[kind]} is not registered`);
  return fallback;
}

/** The `kind` provider named `id`, or the kind's default with one line when `id` is not registered. */
export function providerFor<K extends Kind>(kind: K, id: string, warn: Warn, registry: Registry = REGISTRY): ProviderOf[K] {
  const found = registry[kind].find((provider) => provider.id === id);
  if (found !== undefined) return found;
  const fallback = defaultOf(kind, registry);
  warn(`the ${kind} provider "${id}" is not registered: using ${fallback.id}`);
  return fallback;
}

/** Runs the `kind` provider named `id`; when it fails, the kind's default, with one line. */
async function withFallback<K extends 'music' | 'fonts', T>(kind: K, id: string, run: (provider: ProviderOf[K]) => Promise<T>, warn: Warn, registry: Registry): Promise<T & { provider: string }> {
  const chosen = providerFor(kind, id, warn, registry);
  try {
    return { ...(await run(chosen)), provider: chosen.id };
  } catch (error) {
    const fallback = defaultOf(kind, registry);
    if (fallback === chosen) throw error;
    warn(`the ${kind} from ${chosen.id} failed (${messageOf(error)}): using ${fallback.id}`);
    return { ...(await run(fallback)), provider: fallback.id };
  }
}

/** The music a setting names, with the provider that gave it: silence when it is gone or fails. */
export function pickMusic({ provider, ...request }: MusicRequest & { provider: string }, context: MusicContext, warn: Warn, registry: Registry = REGISTRY): Promise<Track & { provider: string }> {
  return withFallback('music', provider, (chosen) => chosen.pick(request, context), warn, registry);
}

/** The font a setting names, with the provider that gave it: the system font when it is gone or fails. */
export function loadFont({ provider, ...request }: FontRequest & { provider: string }, context: FontsContext, warn: Warn, registry: Registry = REGISTRY): Promise<LoadedFont & { provider: string }> {
  return withFallback('fonts', provider, (chosen) => chosen.load(request, context), warn, registry);
}
