// PRD 1550: `design.ignore` — globs `omni design touched` drops from a diff before it matches
// `design.paths` and the screen library, so a change made only of tests is not read as UI work. Its
// default is the common test shapes; a repository sets its own list, and `[]` drops nothing. The key
// is left unset by `parseConfig` when the file does not name it, and read through `designIgnore`.
import { matchesGlob } from './glob.ts';

/** The common test shapes: the kit names no test framework. */
export const DEFAULT_DESIGN_IGNORE: readonly string[] = Object.freeze(['**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/test/**']);

/** The globs `design.ignore` holds, or the default when the config does not set it. */
export function designIgnore(design: { readonly ignore?: readonly string[] | undefined }): readonly string[] {
  return design.ignore ?? DEFAULT_DESIGN_IGNORE;
}

/** The changed paths no ignore glob matches, in their order. */
export function dropIgnored(ignore: readonly string[], changed: readonly string[]): string[] {
  return changed.filter((path) => !ignore.some((glob) => matchesGlob(glob, path)));
}
