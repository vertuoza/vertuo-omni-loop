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
 * - `scope`: `{prds, roadmaps}`, lists of numbers of this repository, 50 PRDs and 10 roadmaps at
 *   most, one of either at least;
 * - `mandate`: `{parallel}`, how many PRDs may run at once, 1 to 4, 2 when not given.
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

/** One sign the mission worked, how it is read, and its target. */
export type Measure = { sign: string; read: string; target: string };

/** A mission's brief, as its front matter says it. */
export type Brief = {
  mission: IssueNumber;
  title: string;
  fleet: string;
  goal: string;
  measures: Measure[];
  scope: { prds: PrdNumber[]; roadmaps: IssueNumber[] };
  mandate: { parallel: number };
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
  .strict()
  .refine(({ prds, roadmaps }) => prds.length + roadmaps.length > 0, 'names no PRD and no roadmap: one at least');

const MandateSchema = z
  .object({ parallel: z.number({ message: 'must be a number' }).int('must be a whole number').min(1, 'is 1 to 4').max(4, 'is 1 to 4').default(DEFAULT_PARALLEL) }, { message: 'must be {parallel}' })
  .strict();

const BriefSchema = z
  .object({
    mission: IssueNumberSchema,
    title: text(200),
    fleet: text(40).regex(FLEET_KEY, "is not a fleet's key (lowercase, dashes between words)"),
    goal: text(500),
    measures: z.array(MeasureSchema, { message: 'must be a list' }).max(5, 'holds 5 at most').default([]),
    scope: ScopeSchema,
    mandate: MandateSchema.default({ parallel: DEFAULT_PARALLEL }),
  })
  .strict();

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
