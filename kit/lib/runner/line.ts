// The line a runner may run (PRD 1830, "Who may send"): `/omni:<skill> <args>`, its skill one of the
// ones the Omni app copies that run headless and end on their own, its arguments letters, digits,
// spaces and `._/:#-` only, the whole line 200 characters at most. The app's route checks the line
// before it queues a job; `omni runner` checks it again before it runs one, so a line the app should
// never have sent still never runs.
//
// A repository's own skill (PRD 2313): `/<name> <args>`, `<name>` one of the skills the job's
// repository allowed (its `allowedSkills`, read when the job was claimed), never a fixed skill's name,
// so `/yolo` never means `/omni:yolo`. The same length and the same argument characters.

/** The skills a runner runs: they run without a person typing, and end on their own. `committee` is the fleet's (PRD 2896). The ultra skills (PRD 2873) build a PRD
 * across a product's repositories, sent from its plan repository. The PM's four writing skills ({@link PM_SKILLS}, PRD 2896) run
 * only on a job of a mission at `alone`. */
export const RUNNABLE_SKILLS: readonly string[] = Object.freeze([
  'yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove', 'retro-apply', 'rewind', 'knowledge-add',
  'rewind-apply', 'ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'review', 'committee', 'brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap', 'repair',
]);

/** The PM's writing skills (PRD 2896, spec "7. The PM's own PRDs"): a runner takes them for a mission's PM only, on a job of a
 * mission at `alone`. Outside one they need a person at the terminal, as before. */
export const PM_SKILLS: readonly string[] = Object.freeze(['brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap']);

/** The mission a job belongs to, as far as a runner reads it: its level. `null` for a job no mission sent. */
export type JobMission = { level: string } | null;

/** Why fixed skill `skill` may not run on a job of `mission`, or null when it may: a PM skill runs for a mission at `alone` only. */
export function missionRefusal(skill: string, mission: JobMission): string | null {
  if (!PM_SKILLS.includes(skill) || mission?.level === 'alone') return null;
  return `/omni:${skill} runs on a runner for a mission's PM only`;
}

/** The lines only the Omni App sends, each run by the job's process with no agent and no plugin skill: `acceptance`, a gated
 * feature PR's e2e scenarios on its preview (PRD 2898 s8, ./acceptance.ts). A runner takes them as it takes a skill's line; a
 * person's Send never queues one, and no account's `takes` names one. The Omni app holds the same list (`APP_SKILLS` of its
 * runners' contract), which a test of the app holds to this one. */
export const APP_SKILLS: readonly string[] = Object.freeze(['acceptance']);

/** The skills a lost job of is resumed (PRD 2809): the runnable skills that pick up from what GitHub holds (claims, sub-PRs,
 * merged slices), so a second attempt carries the first on. The Omni app's database holds the same list, which a test of the
 * app holds to this one. */
export const RESUMABLE_SKILLS: readonly string[] = Object.freeze(['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix']);

/** The skills whose line names a PRD by its number first: the Omni app's own list, which a test of the app holds to this one. */
const PRD_SKILLS: readonly string[] = Object.freeze(['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'plan', 'pitch', 'prove', 'ultra-yolo', 'ultra-wave', 'ultra-yolo-fix']);

/** The longest line a runner takes, in characters. */
export const LINE_MAX = 200;

/** The longest name a repository's own skill takes, in characters: the database's limit too. */
export const SKILL_NAME_MAX = 64;

const SHAPE = /^\/omni:([a-z][a-z-]*)(?: (.*))?$/s;
const OWN_SHAPE = /^\/([a-z][a-z0-9-]*)(?: (.*))?$/s;
const ARGS = /^[A-Za-z0-9 ._/:#-]*$/;

const BAD_ARGS = 'the arguments hold a character other than letters, digits, spaces and ._/:#-';

/** A line checked: its kind (a fixed skill, or the repository's own), its skill and arguments, or why it
 * is refused, in one line. */
export type RunnerLineCheck = { ok: true; kind: 'omni' | 'repository'; skill: string; args: string } | { ok: false; reason: string };

/** Whether `line` may run on a runner, and why not: `allowed` the repository skills the job carries,
 * none by default, so an older app's job runs as before. */
export function checkRunnerLine(line: string, allowed: readonly string[] = []): RunnerLineCheck {
  if (line.length > LINE_MAX) return { ok: false, reason: `the line is over ${String(LINE_MAX)} characters` };
  const fixed = SHAPE.exec(line);
  if (fixed) return checkFixed(fixed[1] ?? '', fixed[2] ?? '');
  const own = OWN_SHAPE.exec(line);
  if (!own) return { ok: false, reason: 'the line does not read /omni:<skill> <arguments> or /<skill> <arguments>' };
  return checkOwn(own[1] ?? '', own[2] ?? '', allowed);
}

function checkFixed(skill: string, args: string): RunnerLineCheck {
  if (!RUNNABLE_SKILLS.includes(skill) && !APP_SKILLS.includes(skill)) return { ok: false, reason: `/omni:${skill} does not run on a runner` };
  if (!ARGS.test(args)) return { ok: false, reason: BAD_ARGS };
  return { ok: true, kind: 'omni', skill, args };
}

function checkOwn(skill: string, args: string, allowed: readonly string[]): RunnerLineCheck {
  if (skill.length > SKILL_NAME_MAX) return { ok: false, reason: `a skill's name is ${String(SKILL_NAME_MAX)} characters at most` };
  if (!ARGS.test(args)) return { ok: false, reason: BAD_ARGS };
  if (RUNNABLE_SKILLS.includes(skill)) return { ok: false, reason: `/${skill} is the loop's own skill: send /omni:${skill}` };
  if (!allowed.includes(skill)) return { ok: false, reason: `/${skill} is not allowed on a runner for this repository` };
  return { ok: true, kind: 'repository', skill, args };
}

/** The PRD a runner's line names (`/omni:yolo 2251`, `/omni:do-work 2270 s1`), so `omni runner follow` can follow
 * its job (#2592); `null` for any other line. */
export function prdOfRunnerLine(line: string): number | null {
  const checked = checkRunnerLine(line);
  if (!checked.ok || !PRD_SKILLS.includes(checked.skill)) return null;
  const first = checked.args.split(' ')[0] ?? '';
  return /^[1-9]\d*$/.test(first) ? Number(first) : null;
}
