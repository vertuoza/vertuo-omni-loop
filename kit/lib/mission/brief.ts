/**
 * **A mission's brief** (PRD 2842, s2): the one parser for a mission's `mission.md`, and the rules its
 * `mission.html` keeps.
 *
 * A mission is a goal a Virtual Fleet delivers on its own. `/omni:mission` writes its folder,
 * `<delivery>/missions/<nnnn>-<slug>/`, and `omni mission push <n>` sends both files to its page; the
 * Omni app reads `mission.md` with this same parser before it stores the mission. Pure: text in, a
 * typed brief or every fault out, each fault naming its field.
 *
 * The front matter, YAML between `---` fences, holds exactly:
 *
 * - `mission`: the mission's issue number;
 * - `title`: 1 to 200 characters;
 * - `fleet`: the key of a Virtual Fleet of the workspace (the app checks it is one);
 * - `goal`: one sentence, 1 to 500 characters: what changes, and for whom;
 * - `measures`: 0 to 5 observable signs it worked, each `{sign, read, target}` (how it is read, and
 *   the target), each 1 to 200 characters. None yet is a one-line mission's (`/omni:mission --prd`);
 * - `kind`: `prds` (when absent) or `omni-bugs`, the standing Omni Loop bug team (PRD 3088), which takes no scope;
 * - `scope`: `{prds, roadmaps}`, lists of numbers of this repository, 50 PRDs and 10 roadmaps at
 *   most, one of either at least;
 * - `mandate`: `{parallel, level, hardToRevert, ownPrds}`: how many PRDs may run at once (1 to 4, 2 when not
 *   given); the level the mission runs at, `with-you`, `own-branch` or `alone` (`with-you` when not given, the
 *   fleet's level written by `/omni:mission`: PRD 2896); the hard-to-revert score at or above which an item
 *   goes to a person (0 to 1, 0.6) and how many PRDs the fleet may add itself (0 to 10, 0); the last two are
 *   read only at `alone`; and, when it is given, `tokens`, the mission's token budget over every job it ever sent (1 to
 *   10⁹; none, or an empty one, means no budget: PRD 3040, `./budget.ts`).
 *
 * The page's rules, `mission.html`'s, are `./page.ts`'s: this module stays free of Node's built-ins, so
 * the app reads a brief with it.
 */
import { parse } from 'yaml';
import { z } from 'zod';
import { IssueNumberSchema, PrdNumberSchema } from '../ids.ts';
import { messageOf, propertyOf } from '../narrow.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';

/** The brief's two files, as a mission's folder holds them. */
export const MISSION_RECORD = 'mission.md';
export const MISSION_PAGE = 'mission.html';

/** How many PRDs run at once when the mandate says nothing. */
export const DEFAULT_PARALLEL = 2;

/** What a mission may run at, from the one that changes nothing to the one that works alone (PRD 2896). */
export const MISSION_LEVELS = ['with-you', 'own-branch', 'alone'] as const;
export type MissionLevel = (typeof MISSION_LEVELS)[number];
const DEFAULT_LEVEL: MissionLevel = 'with-you';

/** Why `own-branch` is refused for a mission whose PRDs live in a plan repository: no mission branch spans repositories (PRD 2896 s14). */
const PLAN_OWN_BRANCH_REFUSAL = 'a mission branch holds one repository: use with-you or alone';
/** What a plan-repository mission at `alone` says on its page: the committee works, a person still merges (PRD 2896 s14). */
export const COMMITTEE_ONLY_WORDS = "committee only: a person merges each target's pull request";

/** The refusal of `level` for a mission in a plan repository (`inPlan`), or null when it may run at it. */
export function levelRefusal(level: MissionLevel, inPlan: boolean): string | null {
  return inPlan && level === 'own-branch' ? PLAN_OWN_BRANCH_REFUSAL : null;
}
/** What a mission is: PRDs to deliver, or the standing Omni Loop bug team (PRD 3088). */
const MISSION_KINDS = ['prds', 'omni-bugs'] as const;
export type MissionKind = (typeof MISSION_KINDS)[number];
const DEFAULT_KIND: MissionKind = 'prds';

/** Why an `omni-bugs` brief is refused off the Omni Loop repository (PRD 3088, AC-10). */
export const OMNI_BUGS_REPOSITORY_REFUSAL = 'Only the Omni Loop repository runs the Omni Loop bug team';

/**
 * The refusal of a brief of `kind` started on `repository`, or null when it may run there: only the
 * Omni Loop repository (`omniLoopRepository`, `owner/name`, compared without case) runs `omni-bugs`.
 */
export function repositoryRefusal(kind: MissionKind, repository: string, omniLoopRepository: string): string | null {
  if (kind !== 'omni-bugs') return null;
  return repository.trim().toLowerCase() === omniLoopRepository.trim().toLowerCase() ? null : OMNI_BUGS_REPOSITORY_REFUSAL;
}

/** The mandate's two bounds under the level, when the brief says nothing. */
const DEFAULT_HARD_TO_REVERT = 0.6;
const DEFAULT_OWN_PRDS = 0;
/** The highest token budget a mandate takes (PRD 3040). */
export const MAX_MISSION_TOKENS = 1_000_000_000;

/** One sign the mission worked, how it is read, and its target. */
export type Measure = { sign: string; read: string; target: string };

/** A mission's brief, as its front matter says it. */
export type Brief = {
  mission: IssueNumber;
  /** `prds` when the brief says nothing (parseBrief always sets it); `omni-bugs` takes no scope (PRD 3088). Optional so a brief built by hand stays a `prds` one. */
  kind?: MissionKind;
  title: string;
  fleet: string;
  goal: string;
  measures: Measure[];
  scope: { prds: PrdNumber[]; roadmaps: IssueNumber[] };
  /** `tokens`, the mission's token budget, only when the brief gives one: absent, the mission has none (PRD 3040). */
  mandate: { parallel: number; level: MissionLevel; hardToRevert: number; ownPrds: number; tokens?: number };
};

export type BriefParse = { ok: true; brief: Brief } | { ok: false; errors: string[] };

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
/** A fleet's key, as create_virtual_fleet() derives it: lowercase letters and digits, dashes between. */
const FLEET_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = (max: number) => z.string({ message: 'must be text' }).trim().min(1, 'is empty').max(max, `is over ${max} characters`);
const distinct = (list: readonly number[]) => new Set(list).size === list.length;

const MeasureSchema = z.object({ sign: text(200), read: text(200), target: text(200) }, { message: 'must be {sign, read, target}' }).strict();

const ScopeSchema = z
  .object(
    {
      prds: z.array(PrdNumberSchema, { message: 'must be a list of PRD numbers' }).max(50, 'holds 50 PRDs at most')
        .refine(distinct, 'names a PRD twice').default([]),
      roadmaps: z.array(IssueNumberSchema, { message: 'must be a list of roadmap numbers' }).max(10, 'holds 10 roadmaps at most')
        .refine(distinct, 'names a roadmap twice').default([]),
    },
    { message: 'must be {prds, roadmaps}' },
  )
  .strict();
const NO_SCOPE = { prds: [], roadmaps: [] };

const TOKENS_RANGE = `is 1 to ${String(MAX_MISSION_TOKENS)}`;

const MandateSchema = z
  .object(
    {
      parallel: z.number({ message: 'must be a number' }).int('must be a whole number').min(1, 'is 1 to 4').max(4, 'is 1 to 4').default(DEFAULT_PARALLEL),
      level: z.enum(MISSION_LEVELS, { message: `is one of ${MISSION_LEVELS.join(', ')}` }).default(DEFAULT_LEVEL),
      hardToRevert: z.number({ message: 'must be a number' }).min(0, 'is 0 to 1').max(1, 'is 0 to 1').default(DEFAULT_HARD_TO_REVERT),
      ownPrds: z.number({ message: 'must be a number' }).int('must be a whole number').min(0, 'is 0 to 10').max(10, 'is 0 to 10').default(DEFAULT_OWN_PRDS),
      tokens: z.number({ message: 'must be a number' }).int('must be a whole number').min(1, TOKENS_RANGE).max(MAX_MISSION_TOKENS, TOKENS_RANGE)
        .nullish(),
    },
    { message: 'must be {parallel, level, hardToRevert, ownPrds, tokens}' },
  )
  .strict()
  // No budget leaves no key: a brief without one reads as it did before PRD 3040.
  .transform(({ tokens, ...mandate }) => (tokens == null ? mandate : { ...mandate, tokens }));

const DEFAULT_MANDATE = { parallel: DEFAULT_PARALLEL, level: DEFAULT_LEVEL, hardToRevert: DEFAULT_HARD_TO_REVERT, ownPrds: DEFAULT_OWN_PRDS };

const BriefSchema = z
  .object({
    mission: IssueNumberSchema,
    title: text(200),
    fleet: text(40).regex(FLEET_KEY, "is not a fleet's key (lowercase, dashes between words)"),
    goal: text(500),
    measures: z.array(MeasureSchema, { message: 'must be a list' }).max(5, 'holds 5 at most').default([]),
    kind: z.enum(MISSION_KINDS, { message: `is one of ${MISSION_KINDS.join(', ')}` }).default(DEFAULT_KIND),
    scope: ScopeSchema.optional(),
    mandate: MandateSchema.default(DEFAULT_MANDATE),
  })
  .strict()
  // A `prds` mission names a PRD or a roadmap; an `omni-bugs` one names none (its scope is empty).
  .transform(({ scope, ...rest }, ctx) => {
    const named = (scope?.prds.length ?? 0) + (scope?.roadmaps.length ?? 0);
    if (rest.kind === 'omni-bugs') {
      if (named > 0) ctx.addIssue({ code: 'custom', path: ['scope'], message: 'is empty for an omni-bugs mission' });
    } else if (scope === undefined) {
      ctx.addIssue({ code: 'invalid_type', expected: 'object', input: undefined, path: ['scope'], message: 'missing' });
    } else if (named === 0) {
      ctx.addIssue({ code: 'custom', path: ['scope'], message: 'names no PRD and no roadmap: one at least' });
    }
    return { ...rest, scope: scope ?? NO_SCOPE };
  });

/** Where an issue is, as a person reads it: `measures[2].target`, counting from 1. */
function placeOf(path: readonly PropertyKey[]): string {
  return path.reduce<string>((place, key) => (typeof key === 'number' ? `${place}[${key + 1}]` : place ? `${place}.${String(key)}` : String(key)), '');
}

/** The value at `path` in what the front matter read, or undefined when it holds none there. */
function valueAt(raw: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>((value, key) => (typeof value === 'object' ? propertyOf(value, String(key)) : undefined), raw);
}

/** One line per issue of `raw`, the field first. */
function faultsOf(raw: unknown, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const place = placeOf(issue.path);
    if (issue.code === 'unrecognized_keys') return `${place ? `${place}: ` : ''}unexpected field${issue.keys.length > 1 ? 's' : ''} ${issue.keys.join(', ')}.`;
    if (issue.code === 'invalid_type' && valueAt(raw, issue.path) === undefined) return `${place}: missing.`;
    if (place === 'mission' || /^scope\.(prds|roadmaps)\[/.test(place)) return `${place}: must be a positive whole number.`;
    return `${place}: ${issue.message}.`;
  });
}

/** Parses one mission.md (`text`, the file's text) into its brief, or every fault it has. */
export function parseBrief(source: string): BriefParse {
  const block = FRONT_MATTER.exec(source)?.[1];
  if (block === undefined) return { ok: false, errors: ['no front matter: a mission.md opens with a "---" fenced header.'] };
  let raw: unknown;
  try {
    raw = parse(block);
  } catch (error) {
    return { ok: false, errors: [`front matter is not YAML: ${messageOf(error).split('\n')[0] ?? ''}`] };
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['front matter is not YAML key: value lines.'] };
  const read = BriefSchema.safeParse(raw);
  return read.success ? { ok: true, brief: read.data } : { ok: false, errors: faultsOf(raw, read.error) };
}
