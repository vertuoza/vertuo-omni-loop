/**
 * **The PM's own PRDs** (PRD 2896 s12, spec "7. The PM's own PRDs, at `alone`").
 *
 * At `alone`, while the PRDs a mission's fleet added are fewer than `mandate.ownPrds`, the supervisor may send the mission's PM
 * one job for the mission's goal: `/omni:brainstorm` when one PRD is left under the cap, `/omni:roadmap` for several, and the
 * mega skills when the mission's PRDs live in a plan repository. Its line names the mission and the cap it writes under:
 *
 *   /omni:roadmap --mission 12 --cap 3
 *
 * The skill asks nobody, writes at most `cap` PRDs (a roadmap the ones that fit, in its order), each born on the server, and ends
 * on one record line the App reads back from the job's log, as the service (BR-PRODUCT-94: never through a terminal token):
 *
 *   omni pm: {"v":1,"mission":12,"skill":"roadmap","cap":3,"prds":[2950,2951,2952],"unwritten":["Refunds by card"]}
 *
 * `prds` the PRDs it wrote, in order; `unwritten` the titles of the roadmap's rows past the cap, which the mission page names as
 * `not written: the cap is <k>`. The App never takes the record on trust: it keeps at most the cap it sent.
 *
 * **The PM plans and replans** (PRD omni-loop-21 s9, spec "3. The PM plans and replans"). At `alone` the mission sends its PM two
 * more jobs, each for one PRD of its scope:
 *
 *   plan     a PRD with no plan on its page, before its approval: `/omni:plan <n>` for a repository's PRD,
 *            `/omni:mega-brainstorm --product <key> --plan-only <key>-<n>` for a product's
 *   replan   a PRD still stuck once its repairs are spent: the same line ending `--replan`, a new plan version for its slices not
 *            merged yet, never a changed spec
 *
 * Neither ends on a record line: what it wrote is read from the PRD's page, and the committee approves each plan version, the PM
 * sitting out. {@link planOfLine} reads a job's line back, so the App tells a plan job from the PM's own PRDs' job.
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { isProductPrdId, parsePrdId, PrdNumberSchema, productPrdParts, type PrdNumber, type ProductPrdId } from '../ids.ts';
import { PM_SKILLS } from '../runner/line.ts';

/** The most PRDs a mission's fleet may add (`mandate.ownPrds` is 0 to 10). */
const OWN_PRDS_MAX = 10;

/** The longest title of a row a roadmap left unwritten, and how many it names. */
const TITLE_MAX = 120;
const UNWRITTEN_MAX = 20;

/** A PM skill, as a runner takes it for a mission's PM. */
export type PmSkill = 'brainstorm' | 'roadmap' | 'mega-brainstorm' | 'mega-roadmap';

const PmSkillSchema = z.enum(['brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap']);

/** What the line starts with. */
const PM_LINE = 'omni pm: ';

const PmRecordSchema = z.object({
  v: z.literal(1),
  mission: z.number().int().positive(),
  skill: PmSkillSchema,
  cap: z.number().int().min(1).max(OWN_PRDS_MAX),
  prds: z.array(PrdNumberSchema).max(OWN_PRDS_MAX),
  unwritten: z.array(z.string().trim().min(1).max(TITLE_MAX).refine((text) => !/[\r\n]/.test(text))).max(UNWRITTEN_MAX),
});

/** What a PM job wrote for its mission. */
export type PmRecord = z.infer<typeof PmRecordSchema>;

/**
 * The skill the PM is sent, for `left` PRDs still under the cap, or null when none is left: a brainstorm writes one PRD, a roadmap
 * several; in a plan repository, their mega forms. A brainstorm that would pass the cap is never sent. A goal-only mission
 * (PRD omni-loop-24) is always sent the roadmap, even for one PRD left: the roadmap decides whether the goal is one PRD or several.
 */
export function pmSkillFor(left: number, planRepository: boolean, goalOnly = false): PmSkill | null {
  if (!Number.isInteger(left) || left < 1) return null;
  const one = left === 1 && !goalOnly;
  if (planRepository) return one ? 'mega-brainstorm' : 'mega-roadmap';
  return one ? 'brainstorm' : 'roadmap';
}

/** The line a mission's PM job is sent as: the skill, the mission's number and the cap it writes under. */
export const pmJobLine = (skill: PmSkill, mission: number, cap: number): string => `/omni:${skill} --mission ${String(mission)} --cap ${String(cap)}`;

/** Whether a runner's skill is one of the PM's (the runner's own list, {@link PM_SKILLS}). */
export const isPmSkill = (skill: string): skill is PmSkill => PM_SKILLS.includes(skill);

/** A roadmap's rows split at the cap, in its order: the ones it writes, then the ones it leaves unwritten. */
export function fitCap<T>(rows: readonly T[], cap: number): { written: T[]; unwritten: T[] } {
  const room = Math.max(0, Math.floor(cap));
  return { written: rows.slice(0, room), unwritten: rows.slice(room) };
}

/** What the mission page says of a row the cap left unwritten. */
export const notWrittenWords = (cap: number): string => `not written: the cap is ${String(cap)}`;

/** The record as its one line. */
export const pmLine = (record: PmRecord): string => `${PM_LINE}${JSON.stringify(record)}`;

const STAMP = /^\d{2}:\d{2}:\d{2} /;

/** The last record `log` holds for mission `mission` that reads whole; null when it holds none. */
export function pmRecordOf(log: string, mission: number): PmRecord | null {
  for (const raw of log.split('\n').reverse()) {
    const line = raw.trim().replace(STAMP, '');
    if (!line.startsWith(PM_LINE)) continue;
    let json: unknown;
    try {
      json = JSON.parse(line.slice(PM_LINE.length));
    } catch {
      continue;
    }
    const parsed = PmRecordSchema.safeParse(json);
    if (parsed.success && parsed.data.mission === mission) return parsed.data;
  }
  return null;
}

/**
 * What the App keeps of a record, for a job sent under cap `cap`: its PRDs once each, at most the cap, in order, never one the
 * mission already holds; the rest of what it wrote counts as unwritten, by number.
 */
export function keptOf(record: PmRecord, cap: number, held: ReadonlySet<PrdNumber>): { added: PrdNumber[]; unwritten: string[] } {
  const fresh = [...new Set(record.prds)].filter((prd) => !held.has(prd));
  const { written, unwritten } = fitCap(fresh, Math.min(cap, record.cap));
  return { added: written, unwritten: [...unwritten.map((prd) => `PRD ${String(prd)}`), ...record.unwritten] };
}

/** A plan job of the PM (PRD omni-loop-21 s9): a PRD's first plan, or a new version of it once its repairs are spent. */
export type PlanKind = 'plan' | 'replan';

/**
 * The line the PM is sent to plan PRD `prd`: `/omni:plan <n>` for a repository's PRD, `/omni:mega-brainstorm --product <key>
 * --plan-only <key>-<n>` for a product's; a replan's ends with `--replan`.
 */
export function planJobLine(prd: PrdNumber | ProductPrdId, kind: PlanKind): string {
  const tail = kind === 'replan' ? ' --replan' : '';
  if (isProductPrdId(prd)) return `/omni:mega-brainstorm --product ${productPrdParts(prd).key} --plan-only ${prd}${tail}`;
  return `/omni:plan ${String(prd)}${tail}`;
}

const PLAN_LINE = /^\/omni:plan ([1-9][0-9]*)( --replan)?$/;
const PLAN_ONLY_LINE = /^\/omni:mega-brainstorm --product ([a-z][a-z0-9-]*) --plan-only (\S+?)( --replan)?$/;

/** The PRD and kind a plan job's line names; null for any other line, the PM's own PRDs' job included. */
export function planOfLine(line: string): { prd: PrdNumber | ProductPrdId; kind: PlanKind } | null {
  const repository = PLAN_LINE.exec(line);
  const product = PLAN_ONLY_LINE.exec(line);
  const named = repository === null ? product?.[2] : Number(repository[1]);
  const prd = named === undefined ? null : idOf(named);
  if (prd === null) return null;
  const kind: PlanKind = (repository ?? product)?.at(-1) === undefined ? 'plan' : 'replan';
  if (repository !== null) return isProductPrdId(prd) ? null : { prd, kind };
  return isProductPrdId(prd) && productPrdParts(prd).key === product?.[1] ? { prd, kind } : null;
}

/** A PRD's id, or null when it reads as none. */
function idOf(value: number | string): PrdNumber | ProductPrdId | null {
  try {
    return parsePrdId(value);
  } catch {
    return null;
  }
}
