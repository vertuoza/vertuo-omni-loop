// Which PRD the session works on (PRD 324's spec, "Which PRD"): pure. The session's branch is read
// against the config's branch templates, `branches.slice` first, then `branches.feature`, then
// `branches.phase0`; the first template that reads the branch decides. In a template, `{topic}` is
// one or more characters (the shortest that matches) and `{slice}` one or more characters other
// than `/`, so `feat/x--s1` is the slice `s1` of `x`, never a feature named `x--s1`.
//
// The topic names the PRD whose folder is `<nnnn>-<topic>` among the folders the caller found (under
// the delivery folder's inbox and shipped folders, in the session's checkout or on the base). A
// branch no template reads, or whose topic has no folder, names no PRD; then what the session last
// worked on answers (the spec's D10): the PRD number its record names, whose folder is found among the
// same folders. A record whose PRD has no folder names no PRD either.
import { parseFolderName } from '../layout.ts';
import { WorkSliceIdSchema } from '../ids.ts';
import type { PrdNumber, WorkSliceId } from '../ids.ts';

const TEMPLATE_ORDER = ['slice', 'feature', 'phase0'] as const;
const PLACEHOLDER = /\{(topic|slice)\}/g;

/** The config's `branches`, of which the three templates above are read; any other key is ignored. */
export type BranchTemplates = Readonly<Partial<Record<(typeof TEMPLATE_ORDER)[number], unknown>>>;

/** A PRD folder found by its topic or its number. */
export type FoundFolder = { prd: PrdNumber; topic: string; folder: string };

/** The PRD the session works on, and the slice its branch names. */
export type SessionPrd = FoundFolder & { slice: WorkSliceId | null };

const escapeLiteral = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** `template` as an anchored pattern, `{topic}` and `{slice}` captured as named groups; a second
 * `{topic}` (or `{slice}`) must repeat the first. */
export function templatePattern(template: string): RegExp {
  const seen = new Set<string>();
  let source = '';
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    source += escapeLiteral(template.slice(last, match.index));
    const key = match[1] ?? '';
    if (seen.has(key)) source += `\\k<${key}>`;
    else source += key === 'topic' ? '(?<topic>.+?)' : '(?<slice>[^/]+)';
    seen.add(key);
    last = match.index + match[0].length;
  }
  source += escapeLiteral(template.slice(last));
  return new RegExp(`^${source}$`, 'u');
}

/** What `branch` names by the first template that reads it: `{ topic, slice }` (`slice` null but
 * on a slice branch whose `{slice}` is a slice id), or `null`. A template with no `{topic}` names
 * nothing. */
export function branchNames(branch: unknown, branches: BranchTemplates | null | undefined): { topic: string; slice: WorkSliceId | null } | null {
  if (typeof branch !== 'string' || branch === '') return null;
  for (const key of TEMPLATE_ORDER) {
    const template = branches?.[key];
    if (typeof template !== 'string' || !template.includes('{topic}')) continue;
    const groups = templatePattern(template).exec(branch)?.groups;
    // A template holding `{topic}` always captures it once it matches.
    if (groups?.topic !== undefined) return { topic: groups.topic, slice: WorkSliceIdSchema.safeParse(groups.slice).data ?? null };
  }
  return null;
}

/** The PRD folder among `folders` (names) whose topic is `topic`: `{ prd, topic, folder }`, the
 * highest PRD number when several share it, or `null`. */
export function folderOfTopic(folders: readonly string[] | null | undefined, topic: string): FoundFolder | null {
  let found: FoundFolder | null = null;
  for (const name of folders ?? []) {
    const parsed = parseFolderName(name);
    if (!parsed || parsed.topic !== topic) continue;
    if (!found || parsed.prd > found.prd) found = { prd: parsed.prd, topic, folder: name };
  }
  return found;
}

/** The PRD folder among `folders` (names) whose number is `prd`: `{ prd, topic, folder }`, the first
 * found when several carry it, or `null`. */
export function folderOfNumber(folders: readonly string[] | null | undefined, prd: PrdNumber): FoundFolder | null {
  for (const name of folders ?? []) {
    const parsed = parseFolderName(name);
    if (parsed && parsed.prd === prd) return { prd, topic: parsed.topic, folder: name };
  }
  return null;
}

/**
 * The PRD the session works on: the one its branch names, else the one its record names, as
 * `{ prd, topic, folder, slice }` (`slice` only from a slice branch), or `null`. From the session's
 * branch, the config's `branches`, the PRD folder names found in the checkout or on the base, and
 * the PRD number the session's record names.
 */
export function whichPrd({ branch, branches, folders, recorded = null }: {
  branch: string | null;
  branches: BranchTemplates | null | undefined;
  folders: readonly string[];
  recorded?: PrdNumber | null;
}): SessionPrd | null {
  const named = branchNames(branch, branches);
  const fromBranch = named ? folderOfTopic(folders, named.topic) : null;
  if (named && fromBranch) return { ...fromBranch, slice: named.slice };
  const fromRecord = recorded === null ? null : folderOfNumber(folders, recorded);
  return fromRecord ? { ...fromRecord, slice: null } : null;
}
