/**
 * **`--base-of <owner/repo>=<branch>,…`** (PRD omni-loop-21, slice s4): the base each target feature pull request of
 * `/omni:ultra-yolo` opens into, per target repository.
 *
 * A mission above `with-you` cuts one mission branch in every repository its scope touches, and sends a product PRD
 * `/omni:ultra-yolo <key>-<n> --base-of <owner/repo>=<mission branch>,…`: each named target's feature branch is cut
 * from that branch, its target feature PR opens into it, and the run's finish and gate read it wherever they read the
 * target's default branch. A target the flag does not name keeps its default branch.
 *
 * - {@link parseBaseOf} reads the flag's value, refusing it whole, with the reason, when one entry is wrong.
 * - {@link baseOfTarget} gives one target its base: the branch named for it, else its default branch.
 * - {@link strayRepos} names what the flag names that is no target of the PRD, for the run to say it left them out.
 * - {@link baseOfFlag} writes the flag, as a mission's line carries it; {@link refusalLine} is the run's one-line stop.
 *
 * Pure: it reads no file, runs no git and calls no GitHub.
 */

/** The flag, as a skill line names it. */
export const BASE_OF_FLAG = '--base-of';

/** One target repository (`owner/name`) and the branch its target feature PR opens into. */
export type BaseOfEntry = { repo: string; branch: string };

/** A repository as GitHub names it: `owner/name`. */
const SLUG = /^[\w.-]+\/[\w.-]+$/;

/** What `git check-ref-format --branch` refuses anywhere in a name, and `,` and `=`, the flag's own separators. */
const BAD_CHARS = /[\s~^:?*[\\,=]/;

/** Whether `text` holds a control character, which no ref name holds. */
const hasControl = (text: string) => [...text].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);

/** What `git check-ref-format --branch` refuses, one rule each: a name none of them refuses is a branch name. */
const BRANCH_REFUSALS: readonly ((branch: string) => boolean)[] = [
  (branch) => branch === '' || branch === '@',
  (branch) => BAD_CHARS.test(branch) || hasControl(branch),
  (branch) => ['..', '@{', '//'].some((bit) => branch.includes(bit)),
  (branch) => /^[-/]|[/.]$/.test(branch),
  (branch) => branch.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock')),
];

/** Whether `branch` is a name git takes for a branch. */
const isBranchName = (branch: string) => !BRANCH_REFUSALS.some((refuses) => refuses(branch));

/** The reason one entry is refused, or the entry read. */
function readEntry(entry: string): BaseOfEntry | string {
  const at = entry.indexOf('=');
  const repo = at < 0 ? '' : entry.slice(0, at);
  const branch = at < 0 ? '' : entry.slice(at + 1);
  if (repo === '' || branch === '') return `${entry === '' ? 'an empty entry' : entry} is not <owner/repo>=<branch>`;
  if (!SLUG.test(repo)) return `${repo} is not an owner/name`;
  if (!isBranchName(branch)) return `${branch} is not a branch name`;
  return { repo, branch };
}

/** GitHub names a repository whatever its case. */
const sameRepo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The flag's value read: one entry per repository, in the order given, a space after a comma allowed. Refused whole
 * when it names no repository, when an entry is not `<owner/repo>=<branch>`, its repository not an `owner/name` or its
 * branch no branch name, or when a repository is named twice; the reason names the entry.
 */
export function parseBaseOf(value: string): { ok: true; bases: BaseOfEntry[] } | { ok: false; error: string } {
  const entries = value.split(',').map((entry) => entry.trim());
  if (entries.every((entry) => entry === '')) return { ok: false, error: 'names no repository' };
  const bases: BaseOfEntry[] = [];
  for (const entry of entries) {
    const read = readEntry(entry);
    if (typeof read === 'string') return { ok: false, error: read };
    if (bases.some((base) => sameRepo(base.repo, read.repo))) return { ok: false, error: `${read.repo} is named twice` };
    bases.push(read);
  }
  return { ok: true, bases };
}

/** The base of target `slug`: the branch the flag names for it, else `defaultBranch`, the target's own. */
export function baseOfTarget(bases: readonly BaseOfEntry[], slug: string, defaultBranch: string): { base: string; named: boolean } {
  const named = bases.find((base) => sameRepo(base.repo, slug));
  return named === undefined ? { base: defaultBranch, named: false } : { base: named.branch, named: true };
}

/** Each repository the flag names that is none of `targets`, in the order given. */
export const strayRepos = (bases: readonly BaseOfEntry[], targets: readonly string[]): string[] =>
  bases.filter((base) => !targets.some((target) => sameRepo(target, base.repo))).map((base) => base.repo);

/** The flag as a line carries it, `--base-of a/b=c,d/e=f`; empty for no repository, so the line keeps every base. */
export const baseOfFlag = (bases: readonly BaseOfEntry[]): string =>
  bases.length === 0 ? '' : `${BASE_OF_FLAG} ${bases.map(({ repo, branch }) => `${repo}=${branch}`).join(',')}`;

/** The run's one-line stop on a value it refused, before any branch, clone or pull request. */
export const refusalLine = (value: string, why: string): string => `${BASE_OF_FLAG} ${value}: ${why}`;
