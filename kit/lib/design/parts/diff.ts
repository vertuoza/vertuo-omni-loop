// PRD 1559, s2: the parts check over a diff — `omni design parts --check <ref>`. A changed path one of
// a part's `Code` entries matches (the `design.paths` glob semantics) is that part, changed. A
// component file the diff adds (a `.tsx`, `.jsx`, `.vue`, `.svelte` or `.astro` file) under
// `design.paths`, that no part's `Code` names and no library screen's `implements` claims, is
// `off-list`: a new part no one listed, or a screen no one drew. A path a `design.ignore` glob matches
// (by default the test shapes) is neither. When it cannot tell (the ref does not read, or
// `design.paths` is empty, so no file is known to be a screen's), it says `parts: unknown` and never
// guesses. Pure: the caller reads git and the library; it only reports.
import { matchesGlob } from '../glob.ts';
import type { Part } from '../system/read.ts';

/** One changed path, and whether the diff adds it. */
export type Change = { readonly path: string; readonly added: boolean };

/** What the diff check reads: the parts' names and code, the screens' `implements`, and the design globs. */
export type DiffRules = {
  readonly parts: readonly Pick<Part, 'name' | 'code'>[];
  readonly claimed: readonly string[];
  readonly paths: readonly string[];
};

/** The parts the diff changes, in the list's order, and each new component file no part or screen holds; `offList` null when it cannot tell. */
export type DiffParts = { readonly changed: readonly string[]; readonly offList: readonly string[] | null };

const COMPONENT = /\.(?:tsx|jsx|vue|svelte|astro)$/;

const matchesAny = (globs: readonly string[], path: string): boolean => globs.some((glob) => matchesGlob(glob, path));

/** The parts check over a diff's changes, the ignored paths already dropped. */
export function partsOfDiff(changes: readonly Change[], { parts, claimed, paths }: DiffRules): DiffParts {
  const changed = parts.filter((part) => changes.some(({ path }) => matchesAny(part.code, path))).map(({ name }) => name);
  if (paths.length === 0) return { changed, offList: null };
  const named = parts.flatMap(({ code }) => code);
  const offList = changes
    .filter(({ path, added }) => added && COMPONENT.test(path) && matchesAny(paths, path) && !matchesAny(named, path) && !matchesAny(claimed, path))
    .map(({ path }) => path);
  return { changed, offList };
}

/** The lines `omni design parts --check <ref>` prints. */
export function formatDiffParts({ changed, offList }: DiffParts): string[] {
  const lines = [`parts changed: ${changed.length ? changed.join(', ') : 'none'}`];
  if (offList === null) return [...lines, 'parts: unknown — design.paths is empty: judge from the diff whether a new file is a part'];
  if (offList.length === 0) return [...lines, 'parts: all listed'];
  return [...lines, ...offList.map((path) => `off-list: ${path} (added: no part names it, no screen implements it)`)];
}

/** `git diff --name-status -z` output read as changes: a status, then its path. */
export function parseNameStatus(output: string): Change[] {
  const fields = output.split('\0').filter(Boolean);
  const changes: Change[] = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const status = fields[index] ?? '';
    const path = fields[index + 1] ?? '';
    changes.push({ path, added: status.startsWith('A') });
  }
  return changes;
}
