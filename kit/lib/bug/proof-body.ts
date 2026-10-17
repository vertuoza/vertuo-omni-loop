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
 * - the line `GIF not produced - <reason>`, with a reason that is not empty.
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

/** The text of the body's `## Proof` section (the first), up to the next `#` or `##` heading, or `undefined`. */
export function proofSection(body: string): string | undefined {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => PROOF_HEADING.test(line));
  if (start < 0) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => NEXT_HEADING.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

/** Whether `section` holds the line `GIF not produced - <reason>` with a reason. */
function notProduced(section: string): boolean {
  return [...section.matchAll(NOT_PRODUCED)].some((match) => (match[1] ?? '').trim() !== '');
}

/** The faults of a body's `## Proof`, and whether the proof it holds is a produced one. */
function bodyFaults(body: string): { faults: string[]; produced: boolean } {
  const section = proofSection(body);
  if (section === undefined) return { faults: ['no ## Proof section'], produced: false };
  const hasImage = IMAGE.test(section);
  const imageLines = BEFORE_LINE.test(section) && AFTER_LINE.test(section);
  if (hasImage && imageLines) return { faults: [], produced: true };
  if (notProduced(section)) return { faults: [], produced: false };
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
