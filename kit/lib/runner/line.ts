// The line a runner may run (PRD 1830, "Who may send"): `/omni:<skill> <args>`, its skill one of the
// ones the Omni app copies that run headless and end on their own, its arguments letters, digits,
// spaces and `._/:#-` only, the whole line 200 characters at most. The app's route checks the line
// before it queues a job; `omni runner` checks it again before it runs one, so a line the app should
// never have sent still never runs.
//
// A repository's own skill (PRD 2313): `/<name> <args>`, `<name>` one of the skills the job's
// repository allowed (its `allowedSkills`, read when the job was claimed), never a fixed skill's name,
// so `/yolo` never means `/omni:yolo`. The same length and the same argument characters.

/** The skills a runner runs: they run without a person typing, and end on their own. */
export const RUNNABLE_SKILLS: readonly string[] = Object.freeze(['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove', 'retro-apply', 'rewind', 'knowledge-add']);

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
  if (!RUNNABLE_SKILLS.includes(skill)) return { ok: false, reason: `/omni:${skill} does not run on a runner` };
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
