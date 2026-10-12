// Disclosure (PRD 1726): only what a change touches. `omni kb laws` returns a headline per entry,
// never a whole register: every locked law, one plain line each, then — for a set of files, a slice's
// territory or one domain folder — the rules that govern them. A rule says which files it governs on
// its `Governs:` line, matched exactly as the flow areas match their `paths` (`kit/lib/flow/resolve.ts`):
// one dialect, each pattern a regular expression over repository paths. A rule with no `Governs:`
// line is never disclosed for files, so nothing falls back to loading everything; `omni kb status`
// counts those as a backlog.
import { areaOf, resolveFlow } from '../flow/resolve.ts';
import { regexSource } from '../flow/schema.ts';
import { isLaw, type KnowledgeEntry } from './registers.ts';
import type { Thesis } from './thesis.ts';

/** One locked law as `omni kb laws` prints it: its id, its plain sentence, who locked it and when. */
export type DisclosedLaw = { id: string; file: string; sentence: string; lockedBy: string | null; lockedOn: string | null; governs: string[] };

/** One rule or invariant as `omni kb laws` prints it: its id, its headline, what it governs. */
export type DisclosedRule = { id: string; kind: string; file: string; headline: string; governs: string[] | null; proposed: boolean };

/** What `omni kb laws` discloses: the laws, the rules asked for, and how many rules say nothing of their files. */
export type Disclosure = { laws: DisclosedLaw[]; rules: DisclosedRule[]; ungoverned: number };

/** What the rules are disclosed for: files (a list of paths, or a slice's territory), a domain folder, or nothing. */
export type DiscloseFor = { paths: readonly string[] } | { area: string } | null;

/** The area name the matcher gives the patterns of one `Governs:` line. */
const GOVERNED = 'governed';

/** The patterns of a `Governs:` line that are not regular expressions the flow areas would accept. */
export function invalidGoverns(governs: readonly string[]): string[] {
  return governs.filter((source) => !regexSource.safeParse(source).success);
}

/**
 * Whether `path` falls under `governs`, read by the flow areas' own matcher: the patterns become one
 * area's `paths`, and the path is governed when it belongs to that area. A pattern that does not compile
 * matches nothing (`omni check knowledge` refuses it).
 */
export function governsPath(governs: readonly string[], path: string): boolean {
  const valid = governs.filter((source) => regexSource.safeParse(source).success);
  if (valid.length === 0) return false;
  const flow = resolveFlow({ flow: { areas: { [GOVERNED]: { paths: valid } } }, landings: { alone: [] }, pr: { openWith: null } });
  return areaOf(flow, path).name === GOVERNED;
}

/** The first sentence of a statement: a headline, never the whole entry. */
export function headline(statement: string): string {
  const [first = ''] = statement.split(/(?<=[.!?])\s+/);
  return first.trim();
}

/** A rule or an invariant, locked or not. */
const isRuleLike = (entry: KnowledgeEntry): boolean => entry.kind === 'rule' || entry.kind === 'invariant';

/** A law's plain sentence: its thesis line, else its `Proposed law:` sentence, else its statement's headline. */
function lawSentence(entry: KnowledgeEntry, thesis: Thesis | null): string {
  return thesis?.laws.find(({ id }) => id === entry.id)?.sentence ?? entry.proposedLaw ?? headline(entry.statement);
}

/** The locked laws, and the rules `what` asks for: those governing its files, or a domain folder's. */
export function disclose(entries: readonly KnowledgeEntry[], thesis: Thesis | null, what: DiscloseFor): Disclosure {
  const laws = entries.filter(isLaw).map((entry) => ({
    id: entry.id,
    file: entry.file,
    sentence: lawSentence(entry, thesis),
    lockedBy: entry.locked?.by ?? null,
    lockedOn: entry.locked?.on ?? null,
    governs: entry.governs ?? [],
  }));
  const rules = entries.filter((entry) => isRuleLike(entry) && !isLaw(entry));
  const ungoverned = rules.filter((entry) => entry.governs === null).length;
  const chosen = what === null
    ? []
    : 'area' in what
      ? rules.filter((entry) => entry.domain === what.area)
      : rules.filter(({ governs }) => governs !== null && what.paths.some((path) => governsPath(governs, path)));
  return {
    laws,
    rules: chosen.map((entry) => ({
      id: entry.id,
      kind: entry.kind ?? 'rule',
      file: entry.file,
      headline: headline(entry.statement),
      governs: entry.governs,
      proposed: entry.proposed !== null,
    })),
    ungoverned,
  };
}

/** `@login` for a login, as written for a team (`@org/team`) or a login given with its `@`. */
const handle = (owner: string): string => (owner.startsWith('@') ? owner : `@${owner}`);

/**
 * One law as a line a junior developer or PM reads: what it promises, what breaks, and who must agree
 * to change it — `owners` is `laws.owners`, the people CODEOWNERS names for a law's files.
 */
export function lawLine({ id, sentence }: DisclosedLaw, owners: readonly string[]): string {
  const who = owners.length === 0 ? 'its owner' : owners.map(handle).join(' or ');
  return `law ${id} — ${sentence} Changing it needs ${who} to approve the pull request.`;
}

/** One rule as a headline line. */
export function ruleLine({ id, kind, headline: text, proposed }: DisclosedRule): string {
  return `${kind} ${id} — ${text}${proposed ? ' (proposed, not yet confirmed by a person)' : ''}`;
}
