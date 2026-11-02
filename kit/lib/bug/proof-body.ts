/**
 * **A bug fix's pull request carries its proof** (PRD 2100, slice s2).
 *
 * `omni bug <n>` grades the body of the pull request a bug fix opens, because the pinned CLI is the
 * one piece a stale plugin cannot skip. The body comes from `--body-file <file>` (the body the skill
 * is about to open), else from the open pull request whose head is the current branch, read through
 * `gh pr view`; with neither there is nothing to check, and the verdict says how to proceed.
 *
 * Its `## Proof` section passes when it holds either of these:
 *
 * - a markdown image whose link starts with `https://`, a line starting `- **Before the fix**` and a
 *   line starting `- **After the fix**`;
 * - the line `GIF not produced - A: <why>; B: <why>; C: <why>`, a reason for each level of the proof
 *   ladder (PRD 2578), none of them empty.
 *
 * A produced proof also carries the line `- **Proved on:** <where>` (PRD 2578): `a preview
 * environment` (level A) with a `- **Preview:** <url> · <lifetime>` line; `CI` (level B) or `the
 * machine that made the fix` (level C) with `reproduction test only, the screen was not filmed`, or,
 * at level C, `the component filmed in Storybook` beside a `Clips:` line.
 *
 * A proof that was not produced belongs to a draft: read from an open pull request that is not one,
 * it is one more fault. A record with a `## Fixes` section is never checked here (the caller skips it).
 */
import { z } from 'zod';
import type { ExecText } from '../context.ts';
import { PrNumberSchema } from '../ids.ts';
import type { IssueNumber, PrNumber } from '../ids.ts';

/** The pull request body to check, and where it came from. */
export type ProofSource =
  | { kind: 'file'; body: string }
  | { kind: 'pull-request'; body: string; pr: PrNumber; isDraft: boolean }
  | { kind: 'none' };

const PROOF_HEADING = /^##[ \t]+Proof[ \t]*#*[ \t]*$/;
const NEXT_HEADING = /^#{1,2}[ \t]/;
const IMAGE = /!\[[^\]]*\]\([ \t]*https:\/\/[^)\s]+/;
const BEFORE_LINE = /^[ \t]*- \*\*Before the fix\*\*/m;
const AFTER_LINE = /^[ \t]*- \*\*After the fix\*\*/m;
const NOT_PRODUCED = /^[ \t]*GIF not produced - (.*)$/gm;
const PROVED_ON = /^[ \t]*- \*\*Proved on:?\*\*:?[ \t]*(.*)$/m;
const PREVIEW_LINE = /^[ \t]*- \*\*Preview:?\*\*:?[ \t]*\S/m;
const CLIPS_LINE = /^[ \t]*Clips:[ \t]*\S/m;
const LEVEL_BC = /^(CI|the machine that made the fix)/;
const NOT_FILMED = 'reproduction test only, the screen was not filmed';
const STORYBOOK = 'the component filmed in Storybook';
const LEVELS = ['A', 'B', 'C'] as const;

/** The text of the body's `## Proof` section (the first), up to the next `#` or `##` heading, or `undefined`. */
export function proofSection(body: string): string | undefined {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => PROOF_HEADING.test(line));
  if (start < 0) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => NEXT_HEADING.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

/** The reasons of every `GIF not produced - <reason>` line of `section` whose reason is not empty. */
function notProducedReasons(section: string): string[] {
  return [...section.matchAll(NOT_PRODUCED)].map((match) => (match[1] ?? '').trim()).filter((reason) => reason !== '');
}

/** The levels (A, B, C) a not-produced `reason` gives no reason for: each `X: <why>` is a `;`-separated part. */
function levelsWithoutReason(reason: string): string[] {
  const parts = reason.split(';').map((part) => part.trim());
  return LEVELS.filter((level) => !parts.some((part) => part.startsWith(`${level}:`) && part.slice(2).trim() !== ''));
}

/** The faults of a level B or C `Proved on` value: the not-filmed mention, or Storybook beside its `Clips:` line. */
function reproductionFaults(value: string, section: string): string[] {
  if (value.includes(STORYBOOK)) return CLIPS_LINE.test(section) ? [] : ['## Proof\'s "the component filmed in Storybook" line has no "Clips:" line'];
  return value.includes(NOT_FILMED) ? [] : [`## Proof's "Proved on" line has no "${NOT_FILMED}" mention`];
}

/** The faults of a produced proof's `Proved on` line, none when it says where the proof comes from. */
function provedOnFaults(section: string): string[] {
  const proved = PROVED_ON.exec(section);
  if (proved === null) return ['## Proof has no "Proved on" line'];
  const value = (proved[1] ?? '').trim();
  if (value.startsWith('a preview environment')) {
    return PREVIEW_LINE.test(section) ? [] : ['## Proof\'s "Proved on: a preview environment" has no "Preview" line'];
  }
  if (LEVEL_BC.test(value)) return reproductionFaults(value, section);
  return ['## Proof\'s "Proved on" line names no level: a preview environment, CI or the machine that made the fix'];
}

/** The faults of a body's `## Proof`, and whether the proof it holds is a produced one. */
function bodyFaults(body: string): { faults: string[]; produced: boolean } {
  const section = proofSection(body);
  if (section === undefined) return { faults: ['no ## Proof section'], produced: false };
  const hasImage = IMAGE.test(section);
  const imageLines = BEFORE_LINE.test(section) && AFTER_LINE.test(section);
  if (hasImage && imageLines) return { faults: provedOnFaults(section), produced: true };
  const reasons = notProducedReasons(section);
  if (reasons.length > 0) {
    if (reasons.some((reason) => levelsWithoutReason(reason).length === 0)) return { faults: [], produced: false };
    const missing = levelsWithoutReason(reasons[0] ?? '');
    return { faults: missing.map((level) => `## Proof's "GIF not produced" line has no reason for level ${level}`), produced: false };
  }
  if (!hasImage) return { faults: ['## Proof has no image and no "GIF not produced - <reason>" line'], produced: false };
  return { faults: ['## Proof\'s image has no "Before the fix" or "After the fix" line'], produced: false };
}

/** What `omni bug <n>` says when it has no body to check, and how to get one. */
function noBody(issue: IssueNumber): string {
  return (
    'no pull request body to check: make the GIF ' +
    `(omni bug film ${issue} --before <red> --after <green>, then omni proof push --kind bug ${issue} <folder>), ` +
    'write the body with its ## Proof section to a file, ' +
    `and rerun omni bug ${issue} --body-file <file>; ` +
    'with no GIF, ## Proof is the line GIF not produced - <reason> and the pull request opens as a draft'
  );
}

/** The verdict's lines for the proof of issue `issue`'s pull request, none when it carries one. */
export function proofFaults(source: ProofSource, issue: IssueNumber): string[] {
  if (source.kind === 'none') return [noBody(issue)];
  const { faults, produced } = bodyFaults(source.body);
  if (source.kind === 'pull-request' && faults.length === 0 && !produced && !source.isDraft) {
    return [`the proof was not produced but #${source.pr} is not a draft: gh pr ready ${source.pr} --undo`];
  }
  return faults;
}

const ViewedPullRequestSchema = z.object({
  body: z.string().nullable(),
  isDraft: z.boolean(),
  state: z.string(),
  number: PrNumberSchema,
});

/**
 * The open pull request whose head is the branch checked out in `root`, read with `gh pr view`.
 * `none` when there is none: no pull request, a closed or merged one, no `gh`, no sign-in, or an
 * answer that is not a pull request.
 */
export function openPullRequest({ root, exec }: { root: string; exec: ExecText }): ProofSource {
  try {
    const text = exec('gh', ['pr', 'view', '--json', 'body,isDraft,state,number'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const viewed = ViewedPullRequestSchema.safeParse(JSON.parse(text));
    if (!viewed.success || viewed.data.state !== 'OPEN') return { kind: 'none' };
    return { kind: 'pull-request', body: viewed.data.body ?? '', pr: viewed.data.number, isDraft: viewed.data.isDraft };
  } catch {
    return { kind: 'none' };
  }
}
