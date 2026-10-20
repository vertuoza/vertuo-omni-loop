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
 * team or an e-mail never clears a law on its own (fail closed).
 *
 * It also writes one block of the file (PRD 1726, slice s4): the lines between {@link OWNERS_BEGIN}
 * and {@link OWNERS_END}, which `omni kb owners` keeps in step with the locked laws
 * (`codeowners-laws.ts`). {@link withOwnersBlock} replaces that block, or appends it, and leaves
 * every line outside the markers as it was. Each line names every owner of `laws.owners` and each
 * owner's delegate (PRD 1794), so a delegate's approval clears a law; product leadership
 * (`laws.leadership`) is never written there.
 */
import type { LawOwner } from './config.ts';

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

/** The line that opens the block `omni kb owners` writes (PRD 1726). */
export const OWNERS_BEGIN = '# BEGIN omni kb owners';

/** The line that closes it. */
const OWNERS_END = '# END omni kb owners';

/** One path the block owns, and the comment that says why. */
export type OwnedPath = { path: string; why: string };

/** An owner as CODEOWNERS writes it: a login or a team gains its `@`, an e-mail stays as it is. */
export function ownerHandle(owner: string): string {
  const trimmed = owner.trim();
  return trimmed.includes('@') ? trimmed : `@${trimmed}`;
}

/** A repository path as a CODEOWNERS pattern of that one path: anchored at the root, its special characters escaped. */
export function exactPattern(path: string): string {
  return `/${path.replace(/^\/+/, '').replace(/[\\\s#*?[\]!]/g, (char) => `\\${char}`)}`;
}

/**
 * Who the block names for `laws.owners`: each owner, then its delegate (PRD 1794), in the order
 * written. A person named twice, as an owner and as another's delegate, is named once, where first
 * written: GitHub logins compare without case.
 */
export function lawCodeowners(owners: readonly LawOwner[]): string[] {
  const named = owners.flatMap((entry) => (typeof entry === 'string' ? [entry] : [entry.login, entry.delegate]));
  const seen = new Set<string>();
  return named.filter((owner) => {
    const key = owner.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The whole block, its markers included: a line per path, grouped under its `why` comment in the
 * order given, each owned by every one of `owners` and each of their delegates. A path listed twice
 * is written once, under its first `why`.
 */
export function ownersBlock(paths: readonly OwnedPath[], owners: readonly LawOwner[]): string {
  const handles = lawCodeowners(owners).map(ownerHandle).join(' ');
  const lines = [OWNERS_BEGIN, '# Written by `omni kb owners` from laws.owners and the locked laws (PRD 1726): run it again, never edit these lines.'];
  const seen = new Set<string>();
  let why: string | null = null;
  for (const owned of paths) {
    if (seen.has(owned.path)) continue;
    seen.add(owned.path);
    if (owned.why !== why) lines.push(`# ${owned.why}`);
    why = owned.why;
    lines.push(`${exactPattern(owned.path)} ${handles}`);
  }
  lines.push(OWNERS_END);
  return lines.join('\n');
}

/** Where the block sits in `text`'s lines: the index of its opening and its closing marker. */
type BlockSpan = { begin: number; end: number };

/**
 * The block's span in `lines`, `null` when the file holds none. Throws when the markers do not pair
 * up: one of them alone, either twice, or the closing one first.
 */
function blockSpan(lines: readonly string[]): BlockSpan | null {
  const at = (marker: string) => lines.flatMap((line, index) => (line.trim() === marker ? [index] : []));
  const begins = at(OWNERS_BEGIN);
  const ends = at(OWNERS_END);
  if (begins.length === 0 && ends.length === 0) return null;
  const [begin] = begins;
  const [end] = ends;
  if (begins.length !== 1 || ends.length !== 1 || begin === undefined || end === undefined || end < begin) {
    throw new Error(`its "${OWNERS_BEGIN}" and "${OWNERS_END}" lines do not pair up — keep exactly one of each, in that order, or remove both`);
  }
  return { begin, end };
}

/** The block `text` holds, its markers included, `null` when it holds none; throws when its markers do not pair up. */
export function ownersBlockIn(text: string): string | null {
  const lines = text.split('\n');
  const span = blockSpan(lines);
  return span === null ? null : lines.slice(span.begin, span.end + 1).map((line) => line.replace(/\r$/, '')).join('\n');
}

/**
 * `text` with its block replaced by `block`, or with `block` appended after a blank line when it has
 * none (`null`: no file yet). Every line outside the markers is kept byte for byte; throws when the
 * markers do not pair up.
 */
export function withOwnersBlock(text: string | null, block: string): string {
  if (text === null || text === '') return `${block}\n`;
  const lines = text.split('\n');
  const span = blockSpan(lines);
  if (span === null) return `${text}${text.endsWith('\n') ? '' : '\n'}\n${block}\n`;
  return [...lines.slice(0, span.begin), block, ...lines.slice(span.end + 1)].join('\n');
}
