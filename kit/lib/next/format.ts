// PRD 1139: `omni next`'s lines for a person — one verdict, the loop plan, and a tick on the plan.
// PRD 1205: the tick's pool — each step to launch, each step running, each step held.
import type { Verdict } from './decide.ts';
import { stepWhat } from './follow.ts';
import type { Followed, Pool } from './follow.ts';
import { crossOrders } from './plan.ts';
import type { LoopPlan, Step } from './plan.ts';

/** One verdict, as one line for a person (slice s1). */
export function verdictLine(verdict: Verdict): string {
  const head = verdict.verdict === 'act' ? `act ${verdict.skill}` : verdict.verdict;
  const wake = verdict.verdict === 'wait' ? ` (look again in ${Math.round(verdict.wakeHint / 60)} min)` : '';
  return `PRD ${verdict.prd} — ${head}: ${verdict.why}${wake}${verdict.link ? ` — ${verdict.link}` : ''}`;
}

/** What a step does, in words: `PRD 7 wave 1: s1, s2`, `PRD 7 finish`. */
function stepWords(step: Step): string {
  if (step.kind !== 'wave') return `PRD ${step.prd} ${step.kind}`;
  const wave = step.wave === null ? 'slices with no wave' : `wave ${step.wave}`;
  return `PRD ${step.prd} ${wave}: ${step.slices.join(', ')}`;
}

/** The loop plan: a header, one line per step with what it comes after and runs beside, then every
 * order between PRDs with its reason. */
export function formatPlan(plan: LoopPlan): string[] {
  const head = `loop plan v${plan.version} · PRDs ${plan.prds.join(', ')} · ${plan.steps.length} step${plan.steps.length === 1 ? '' : 's'}`;
  const steps = plan.steps.map((step) => {
    const after = step.after.length > 0 ? ` · after ${step.after.join(', ')}` : '';
    const waits = step.waitsFor.length > 0 ? ` · waits for PRD ${step.waitsFor.join(', ')} to ship` : '';
    const beside = step.beside.length > 0 ? ` · beside ${step.beside.join(', ')}` : '';
    const repos = step.repos ? ` · in ${step.repos.join(', ')}` : '';
    return `  ${step.step}. ${stepWords(step)}${after}${waits}${beside}${repos}`;
  });
  const orders = crossOrders(plan);
  return [head, ...steps, ...(orders.length > 0 ? ['orders across PRDs:', ...orders.map((order) => `  ${order}`)] : [])];
}

/** A tick on the plan: the step and its verdict, or the stop with what each PRD waits on. */
export function formatFollowed(plan: LoopPlan, followed: Followed): string[] {
  if (followed.state === 'stop') return ['stop: every PRD is parked or done', ...followed.waiting.map(verdictLine)];
  return [`step ${followed.step.step}/${plan.steps.length} · ${verdictLine(followed.verdict)}`];
}

/** A tick's pool: one line per step to launch, then one per step running and one per step held. */
export function formatPool(plan: LoopPlan, pool: Pool): string[] {
  const launch = pool.steps.map(({ step, verdict }) => `step ${step.step}/${plan.steps.length} · ${verdictLine(verdict)}`);
  const running = pool.running.map(({ step, since }) => `  step ${step.step} (${stepWhat(step)}) running since ${since}${step.repos ? ` · in ${step.repos.join(', ')}` : ''}`);
  const held = pool.held.map(({ step, why }) => `  step ${step.step} (${stepWhat(step)}) held: ${why}`);
  return [...launch, ...running, ...held];
}
