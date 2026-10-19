// The line a runner may run (PRD 1830, "Who may send"): `/omni:<skill> <args>`, its skill one of the
// ones the Omni app copies that run headless and end on their own, its arguments letters, digits,
// spaces and `._/:#-` only, 200 characters at most. The app's route checks the line before it queues
// a job; `omni runner` checks it again before it runs one, so a line the app should never have sent
// still never runs.

/** The skills a runner runs: they run without a person typing, and end on their own. */
export const RUNNABLE_SKILLS: readonly string[] = Object.freeze(['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove']);

/** The longest line a runner takes, in characters. */
export const LINE_MAX = 200;

const SHAPE = /^\/omni:([a-z][a-z-]*)(?: (.*))?$/s;
const ARGS = /^[A-Za-z0-9 ._/:#-]*$/;

/** A line checked: its skill and arguments, or why it is refused, in one line. */
export type RunnerLineCheck = { ok: true; skill: string; args: string } | { ok: false; reason: string };

/** Whether `line` may run on a runner, and why not. */
export function checkRunnerLine(line: string): RunnerLineCheck {
  if (line.length > LINE_MAX) return { ok: false, reason: `the line is over ${String(LINE_MAX)} characters` };
  const match = SHAPE.exec(line);
  if (!match) return { ok: false, reason: 'the line does not read /omni:<skill> <arguments>' };
  const skill = match[1] ?? '';
  const args = match[2] ?? '';
  if (!RUNNABLE_SKILLS.includes(skill)) return { ok: false, reason: `/omni:${skill} does not run on a runner` };
  if (!ARGS.test(args)) return { ok: false, reason: 'the arguments hold a character other than letters, digits, spaces and ._/:#-' };
  return { ok: true, skill, args };
}
