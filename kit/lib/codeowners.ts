/**
 * **CODEOWNERS, read** (PRD 1726, slice s3).
 *
 * The gate's `law-locked` rule is cleared only by an approving review from a person CODEOWNERS
 * lists for every file that fired it. This module reads that file the way GitHub does:
 *
 * - GitHub reads the first `CODEOWNERS` it finds in the `.github` folder, at the root, then in the
 *   `docs` folder ({@link CODEOWNERS_FILES}, {@link readCodeowners}); the caller hands the base
 *   branch's files in.
 * - Each line is a pattern and its owners; `#` starts a comment. The **last** matching line wins,
 *   and a matching line with no owner leaves the path unowned ({@link ownersOf}).
 * - A pattern follows GitHub's gitignore dialect: a leading `/`, or a `/` inside it, anchors it at
 *   the root, otherwise it matches at any depth; a trailing `/` matches only what sits under a
 *   folder; `*` and `?` stay inside one segment and `**` crosses them; a pattern whose last segment
 *   holds no wildcard also owns everything under that path, and `src/*` owns only `src`'s own files.
 *
 * An owner is `@login`, `@org/team` or an e-mail. Only `@login` names a person a review can be
 * matched to ({@link isOwnedBy}): a team's members cannot be read with the App's permissions, so a
 * team or an e-mail never clears a law on its own (fail closed). The writer (`omni kb owners`) is s4's.
 */

/** The folders GitHub looks for the file in, in the order it looks: `''` is the root. */
const CODEOWNERS_FOLDERS = ['.github', '', 'docs'];

/** Where GitHub looks for the file, in the order it looks. */
export const CODEOWNERS_FILES = Object.freeze(CODEOWNERS_FOLDERS.map((folder) => (folder === '' ? 'CODEOWNERS' : `${folder}/CODEOWNERS`)));

/** One line of the file: its pattern, as a matcher, and its owners as written. */
export type CodeownersRule = { pattern: string; owners: string[]; matches: (path: string) => boolean };

/** The file GitHub would read, `null` when there is none, and its rules in the file's order. */
export type Codeowners = { file: string | null; rules: CodeownersRule[] };

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One segment-aware glob, translated: `**` crosses folders, `*` and `?` stay in one segment. */
function globSource(glob: string): string {
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob.charAt(i);
    if (glob.startsWith('**/', i)) {
      source += '(?:.*/)?';
      i += 2;
    } else if (glob.startsWith('**', i)) {
      source += '.*';
      i += 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += escapeRegExp(char);
  }
  return source;
}

/** A CODEOWNERS pattern as a matcher of paths from the repository's root. */
export function patternMatcher(pattern: string): (path: string) => boolean {
  const folderOnly = pattern.endsWith('/');
  const body = pattern.replace(/^\/+/, '').replace(/\/+$/, '');
  const anchored = pattern.startsWith('/') || body.includes('/');
  const last = body.slice(body.lastIndexOf('/') + 1);
  const under = folderOnly ? '/.+' : /[*?]/.test(last) ? '' : '(?:/.*)?';
  const regex = new RegExp(`^${anchored ? '' : '(?:.*/)?'}${globSource(body)}${under}$`);
  return (path) => regex.test(path);
}

/** Parses the file's text into its rules, comments and blank lines left out. */
export function parseCodeowners(text: string): CodeownersRule[] {
  const rules: CodeownersRule[] = [];
  for (const line of text.split('\n')) {
    const [pattern, ...rest] = line.trim().split(/\s+/);
    if (pattern === undefined || pattern === '' || pattern.startsWith('#')) continue;
    const comment = rest.findIndex((token) => token.startsWith('#'));
    const owners = comment === -1 ? rest : rest.slice(0, comment);
    rules.push({ pattern, owners, matches: patternMatcher(pattern) });
  }
  return rules;
}

/**
 * The file GitHub reads among `read`'s answers: the first of {@link CODEOWNERS_FILES} that `read`
 * returns text for (`null`: no such file), parsed.
 */
export function readCodeowners(read: (file: string) => string | null): Codeowners {
  for (const file of CODEOWNERS_FILES) {
    const text = read(file);
    if (text !== null) return { file, rules: parseCodeowners(text) };
  }
  return { file: null, rules: [] };
}

/** The owners of `path`: the last matching rule's, none when no rule matches. */
export function ownersOf(codeowners: Pick<Codeowners, 'rules'>, path: string): string[] {
  let owners: string[] = [];
  for (const rule of codeowners.rules) if (rule.matches(path)) owners = rule.owners;
  return owners;
}

/** An owner that names one person, `@login`: never a team (`@org/team`) or an e-mail. */
export function isPersonOwner(owner: string): boolean {
  return /^@[^/@\s]+$/.test(owner);
}

/** Whether `login` is one of `owners`, as a person: GitHub logins compare without case. */
export function isOwnedBy(owners: readonly string[], login: string): boolean {
  const wanted = `@${login}`.toLowerCase();
  return owners.some((owner) => isPersonOwner(owner) && owner.toLowerCase() === wanted);
}
