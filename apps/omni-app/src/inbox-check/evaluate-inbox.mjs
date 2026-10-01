// `evaluateInbox`: the inbox check's verdict on a phase-0 PR (PRD 675), pure. Two snapshot folders,
// the PR's head branch, its changed paths and commits from the compare, and its PRD issue in; the
// check run's `{ name, conclusion, title, summary, gates, prd }` out — or `null` when the PR gets no
// inbox check at all (no config on the base, or a head branch that is not of the phase-0 shape).
//
// Config from base, delivery from head, the way the outbox check reads them: `base` holds the base
// branch's `.omni-loop/config.yml`, `head` holds the head's delivery folder (and knowledge domains).
// Every rule is the kit's, imported unchanged: `phase0Verdict` (what `omni phase0 <n>` prints),
// `inboxViolationsFor` (the inbox rules for this PRD's folder only, so a broken folder of another PRD
// never turns this PR red) and `gradePlan` (the part of `omni plan check <n>` that reads `plan.md`).
// The fourth gate, the PRD issue, is read here from what the caller fetched. The fifth, canon (PRD 839),
// grades the PRD's `spec.md` against the repository's business through the injected `canon` gate
// (../canon/canon.mjs); it is neutral, never red, when it cannot judge, so it never fails a PR on its
// own failure.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILE, ConfigError, parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.mjs';
import { inboxViolationsFor } from 'vertuo-omni-plan/kit/lib/inbox/check-inbox.mjs';
import { gradePlan } from 'vertuo-omni-plan/kit/lib/inbox/plan-grade.mjs';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.mjs';
import { phase0Verdict } from 'vertuo-omni-plan/kit/lib/policy/phase-0.mjs';
import { CANON_GATE, neutral } from '../canon/canon.mjs';
import { canonMarker } from './canon-actions.mjs';

/**
 * @typedef {{ number: number, state: string, labels: string[], isPullRequest: boolean } | null} IssueFacts
 *   `null`: GitHub has no issue of that number
 * @typedef {{ name: string, ok: boolean, reason: string, neutral?: boolean, title?: string, details?: string[] }} Gate
 *   `neutral`: the gate could not judge; it counts as ok. `title`: how a failed gate reads in the title.
 * @typedef {{ state: 'green' | 'red' | 'neutral', reason: string, claimsRead: number,
 *   findings: { quote: string, claims: string[], why: string }[], persona: { name: string, line: string } | null }} CanonFacts
 * @typedef {{ name: string, prd: number | null, conclusion: 'success' | 'failure', title: string, summary: string, gates: Gate[], canon: CanonFacts | null }} InboxVerdict
 */

/** The `{topic}` a head branch was cut for, read back through `branches.phase0`, or `null`. */
export function phase0Topic(headRef, template) {
  if (typeof headRef !== 'string' || !template.includes('{topic}')) return null;
  const [prefix, suffix = ''] = template.split('{topic}');
  if (headRef.length <= prefix.length + suffix.length) return null;
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  return headRef.slice(prefix.length, headRef.length - suffix.length) || null;
}

/** The parsed base config, or `null` when the base has none or it does not parse. */
function readConfigAt(base) {
  const file = join(base, CONFIG_FILE);
  if (!existsSync(file)) return null;
  try {
    return parseConfig(readFileSync(file, 'utf8'), CONFIG_FILE);
  } catch (error) {
    if (error instanceof ConfigError) return null;
    throw error;
  }
}

/** The PRD number of the inbox folder `<nnnn>-<topic>` in the head snapshot, or `null`. */
export function inboxPrd({ head, config, topic }) {
  const dir = join(head, createContext(head, config).layout.dirs.inbox);
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const parsed = entry.isDirectory() ? parseFolderName(entry.name) : null;
    if (parsed?.topic === topic) return parsed.prd;
  }
  return null;
}

/**
 * @param {{
 *   base: string,
 *   head: string,
 *   pr: { headRef: string },
 *   repo?: string,
 *   changes: { path: string, status?: string }[],
 *   commits: { sha: string, message: string }[],
 *   issue: IssueFacts,
 *   canon?: { grade: (input: { repo: string, spec: string }) => Promise<Gate & { canon: CanonFacts }> },
 * }} input  `repo`: the PR's `owner/name`; `canon`: the canon gate, neutral when none is given
 * @returns {Promise<InboxVerdict | null>}
 */
export async function evaluateInbox({ base, head, pr, repo, changes, commits, issue, canon }) {
  const config = readConfigAt(base);
  if (!config) return null;
  const topic = phase0Topic(pr.headRef, config.branches.phase0);
  if (topic === null) return null;

  const name = config.ci.inboxContext;
  const prd = inboxPrd({ head, config, topic });
  if (prd === null) {
    const title = `no inbox folder for topic \`${topic}\``;
    return {
      name,
      prd,
      conclusion: 'failure',
      title,
      summary: `${title} under \`${config.paths.delivery}\` on the head branch \`${pr.headRef}\`.`,
      gates: [],
      canon: null,
    };
  }

  const ctx = createContext(head, config);
  const gates = [
    phase0Gate({ ctx, prd, changes, commits }),
    inboxGate({ ctx, prd }),
    planGate({ ctx, prd, head }),
    issueGate({ prd, issue, label: config.labels.prd }),
  ];
  const { canon: facts, ...canonGate } = await canonGateOf({ canon, ctx, prd, head, repo });
  gates.push(canonGate);
  return {
    name,
    prd,
    conclusion: gates.every((gate) => gate.ok) ? 'success' : 'failure',
    title: titleOf(gates),
    summary: summaryOf({ prd, folder: ctx.layout.whereIs(prd).name, gates, marker: canonMarker({ prd, canon: facts }) }),
    gates,
    canon: facts,
  };
}

/** The canon gate on the PRD's `spec.md`; neutral when no gate is wired or there is no spec to read. */
async function canonGateOf({ canon, ctx, prd, head, repo }) {
  if (!canon || !repo) return neutral('the canon gate is not wired here');
  const file = join(head, ctx.layout.specPath(prd));
  if (!existsSync(file)) return neutral(`no spec.md in ${ctx.layout.whereIs(prd).dir}`);
  return canon.grade({ repo, spec: readFileSync(file, 'utf8') });
}

/** Every failed gate by its title; else how many judged gates are ok, with the canon gate's word. */
function titleOf(gates) {
  const failed = gates.filter((gate) => !gate.ok);
  if (failed.length > 0) return `Not ok: ${failed.map((gate) => gate.title ?? gate.name).join(', ')}`;
  const judged = gates.filter((gate) => !gate.neutral);
  const canon = gates.find((gate) => gate.name === CANON_GATE);
  const tail = canon.neutral ? ' · canon neutral' : ` · ${canon.reason}`;
  return `Phase-0 PR complete: ${judged.length} of ${judged.length} gates ok${tail}`;
}

function phase0Gate({ ctx, prd, changes, commits }) {
  const verdict = phase0Verdict(
    (changes ?? []).map((change) => change.path),
    { ctx, prd, commits },
  );
  return { name: 'phase-0 verdict', ok: verdict.ok, reason: verdict.reason };
}

function inboxGate({ ctx, prd }) {
  const violations = inboxViolationsFor({ ctx, prd });
  return violations.length === 0
    ? { name: 'inbox folder', ok: true, reason: `${ctx.layout.whereIs(prd).dir} follows the inbox rules` }
    : { name: 'inbox folder', ok: false, reason: violations.join('; ') };
}

function planGate({ ctx, prd, head }) {
  const file = ctx.layout.planPath(prd);
  const absolute = join(head, file);
  if (!existsSync(absolute)) {
    return { name: 'plan', ok: false, reason: `no plan.md in ${ctx.layout.whereIs(prd).dir}` };
  }
  const graded = gradePlan(readFileSync(absolute, 'utf8'), { config: ctx.config });
  if (graded.violations.length > 0) return { name: 'plan', ok: false, reason: graded.violations.join('; ') };
  const slices = graded.slices.length;
  const waves = graded.waves.length;
  return {
    name: 'plan',
    ok: true,
    reason: `${slices} slice${slices === 1 ? '' : 's'} in ${waves} wave${waves === 1 ? '' : 's'}, no collision`,
  };
}

function issueGate({ prd, issue, label }) {
  const fail = (reason) => ({ name: 'PRD issue', ok: false, reason });
  if (!issue) return fail(`issue #${prd} does not exist`);
  if (issue.isPullRequest) return fail(`#${prd} is a pull request, not an issue`);
  if (issue.state !== 'open') return fail(`issue #${prd} is ${issue.state}`);
  if (!issue.labels.includes(label)) return fail(`issue #${prd} does not carry the label ${label}`);
  return { name: 'PRD issue', ok: true, reason: `issue #${prd} is open and carries ${label}` };
}

/** The gates line by line; a red canon's facts last, hidden, for its buttons (./canon-actions.mjs). */
function summaryOf({ prd, folder, gates, marker }) {
  const lines = gates.flatMap((gate) => [
    `- ${gate.neutral ? 'neutral' : gate.ok ? 'ok' : 'not ok'} — ${gate.name}: ${gate.reason}`,
    ...(gate.details ?? []).map((detail) => `  - ${detail}`),
  ]);
  return [`PRD ${prd} (\`${folder}\`)`, '', ...lines, ...(marker ? ['', marker] : [])].join('\n');
}
