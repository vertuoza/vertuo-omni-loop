// PRD 1369: whether a diff touches a screen — the answer `omni design touched` prints and
// `/omni:do-work` reads to start `/omni:pixel-perfect review`. Pure: the caller hands it the config's
// `design` section and the changed paths. It only reports: no answer here ever blocks anything.
import { posix } from 'node:path';
import { matchesGlob } from './glob.ts';
import type { Screen } from './screens.ts';

/** The config's `design` section, as this module reads it. */
export type DesignSection = { readonly enabled: boolean; readonly paths: readonly string[] };

/**
 * `off` while `design.enabled` is false; `unknown` when `design.paths` is empty (or, with a `reason`,
 * when the diff cannot be read); `yes` with the changed paths a glob matches; `no` otherwise.
 */
export type Touched =
  | { readonly ui: 'off' }
  | { readonly ui: 'unknown'; readonly reason?: string }
  | { readonly ui: 'yes'; readonly paths: readonly string[] }
  | { readonly ui: 'no' };

/** Whether the changed paths touch the screens `design.paths` names. */
export function designTouched(design: DesignSection, changed: readonly string[]): Touched {
  if (!design.enabled) return { ui: 'off' };
  if (design.paths.length === 0) return { ui: 'unknown' };
  const paths = [...new Set(changed)].filter((path) => design.paths.some((glob) => matchesGlob(glob, path)));
  return paths.length ? { ui: 'yes', paths } : { ui: 'no' };
}

const EMPTY_PATHS = 'design.paths is empty: judge from the diff whether a screen changed';

/** The lines `omni design touched` prints: the answer first, alone on its line. */
export function formatTouched(touched: Touched): string[] {
  switch (touched.ui) {
    case 'off':
      return ['design: off'];
    case 'no':
      return ['ui: no'];
    case 'unknown':
      return ['ui: unknown', touched.reason ?? EMPTY_PATHS];
    case 'yes':
      return ['ui: yes', ...touched.paths.map((path) => `  ${path}`)];
  }
}

/** A library screen as the `screens:` line reads it. */
export type ScreenTouch = Pick<Screen, 'screen' | 'status' | 'routes' | 'implements'>;

/**
 * PRD 1407: the library screens whose `implements` entries a changed path matches, with the path
 * semantics `design.paths` uses, in the library's order. `design.paths` plays no part here: a screen
 * names its own paths.
 */
export function screensTouched<T extends ScreenTouch>(screens: readonly T[], changed: readonly string[]): T[] {
  return screens.filter((screen) => touches(screen.implements, changed));
}

/** A library screen as the `reads` half of the `screens:` line reads it. */
export type ScreenRead = Pick<Screen, 'screen' | 'implements' | 'reads'>;

const touches = (globs: readonly string[], changed: readonly string[]) => globs.some((glob) => changed.some((path) => matchesGlob(glob, path)));

/**
 * PRD 1550: the library screens a changed path reaches only through their `reads` — the code behind
 * the screen — and through no `implements` entry, in the library's order. Such a change never trips
 * a lock: the `screens:` line names each as `reads <screen>`.
 */
export function screensRead<T extends ScreenRead>(screens: readonly T[], changed: readonly string[]): T[] {
  return screens.filter((screen) => touches(screen.reads, changed) && !touches(screen.implements, changed));
}

/** A library screen as the stale-mockup note reads it. */
export type MockedScreen = Pick<Screen, 'screen' | 'mock'>;

/**
 * PRD 1550: of the screens a change touches through `implements`, the names of those with a mockup
 * the change leaves alone. `mock` is a file beside the screen, so it is read under the library's
 * folder `dir`. A screen with no mockup is fine: it is never named.
 */
export function staleMocks(touched: readonly MockedScreen[], changed: readonly string[], dir: string): string[] {
  const paths = new Set(changed.map((path) => posix.normalize(path)));
  return touched.filter(({ mock }) => mock !== null && !paths.has(posix.join(dir, mock))).map(({ screen }) => screen);
}

/** One `mock may be stale: <screen>` line per screen: a note, never a block. */
export function formatStaleMocks(screens: readonly string[]): string[] {
  return screens.map((screen) => `mock may be stale: ${screen}`);
}

/** One screen on the `screens:` line: a lock when locked, else its status, then its routes. */
function screenLabel({ screen, status, routes }: ScreenTouch): string {
  const mark = status === 'locked' ? ' 🔒' : ` (${status})`;
  return `${screen}${mark}${routes.length ? ` (${routes.join(', ')})` : ''}`;
}

/**
 * The `screens:` line `omni design touched` adds below its answer: each screen an `implements` entry
 * touches, then each screen only `read` (PRD 1550) as `reads <screen>`; no line when there is none.
 */
export function formatScreensTouched(screens: readonly ScreenTouch[], read: readonly Pick<Screen, 'screen'>[] = []): string[] {
  const labels = [...screens.map(screenLabel), ...read.map(({ screen }) => `reads ${screen}`)];
  return labels.length ? [`screens: ${labels.join(' · ')}`] : [];
}
