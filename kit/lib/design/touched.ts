// PRD 1369: whether a diff touches a screen — the answer `omni design touched` prints and
// `/omni:do-work` reads to start `/omni:pixel-perfect review`. Pure: the caller hands it the config's
// `design` section and the changed paths. It only reports: no answer here ever blocks anything.
import { matchesGlob } from './glob.ts';

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
