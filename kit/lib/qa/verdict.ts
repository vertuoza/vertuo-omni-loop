/**
 * **QA's verdict and its record line** (PRD 3001, spec "2. `/omni:qa`", steps 4 and 5).
 *
 * `/omni:qa` checks a PRD's feature PR and ends on one line the App reads back from the job's log, as it reads
 * `omni review:` (PRD 2871):
 *
 *   omni qa: posted round 1 (pass) on PR #12: <comment url>
 *   omni qa: posted round 1 (bugs, 2: #3012 #3013) on PR #12: <comment url>
 *
 * A verdict is a pass, or one to five bugs, each by the issue QA filed, the most serious first: the supervisor sends
 * the Engineer one `/omni:bug-fix` per issue, in that order. The last `omni qa: posted` line of a log wins; a log with
 * none, or whose last one does not read whole (a round other than 1 or 2, a sixth bug, a count its issues do not
 * match), reads as no verdict, and the App ends the job `failed · verdict not read`. Only the verdict, the pull
 * request and GitHub's link to the comment are kept: never a line of the log (L-GDPR-2).
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { IssueNumberSchema, PrNumberSchema, type PrNumber } from '../ids.ts';

/** The bugs one round of QA files at most (spec, step 4): a sixth is not filed. */
const MAX_BUGS = 5;

/** QA's round: the first check, and the one after the Engineer's fixes. There is no third. */
const QaRoundSchema = z.union([z.literal(1), z.literal(2)]);

const QaBugSchema = z.strictObject({ issue: IssueNumberSchema });

/** What one round of QA found: a pass, or one to five bugs, each its own issue, in the order they are fixed. */
export const QaVerdictSchema = z.discriminatedUnion('verdict', [
  z.strictObject({ round: QaRoundSchema, verdict: z.literal('pass') }),
  z.strictObject({
    round: QaRoundSchema,
    verdict: z.literal('bugs'),
    bugs: z
      .array(QaBugSchema)
      .min(1)
      .max(MAX_BUGS)
      .refine((bugs) => new Set(bugs.map((bug) => bug.issue)).size === bugs.length, 'each bug is its own issue'),
  }),
]);

/** One round's verdict, as the supervisor acts on it. */
export type QaVerdict = z.infer<typeof QaVerdictSchema>;

/** A verdict read from a job's log: the verdict, its count of bugs, the pull request QA checked and its comment's link. */
export type QaPosted = { verdict: QaVerdict; count: number; pr: PrNumber; url: string | null };

/** Where the record line starts. */
const POSTED_PREFIX = 'omni qa: posted ';

/** The whole line, from its prefix to its link, which ends it. */
const POSTED = /omni qa: posted round (\d+) \((pass|bugs, (\d+)(?:: (#\d+(?: #\d+)*))?)\) on PR #(\d+): (\S+)$/;

/** A comment's link as GitHub gives it: a pull request of a repository, or one comment on it. */
const COMMENT_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(?:#issuecomment-\d+)?$/;

/** The verdict as its record line, the one `qaLine` reads. */
export function qaPostedLine(verdict: QaVerdict, pr: PrNumber, url: string): string {
  const found = verdict.verdict === 'pass' ? 'pass' : `bugs, ${String(verdict.bugs.length)}: ${verdict.bugs.map((bug) => `#${String(bug.issue)}`).join(' ')}`;
  return `${POSTED_PREFIX}round ${String(verdict.round)} (${found}) on PR #${String(pr)}: ${url}`;
}

/** The verdict a job's log ends on: its last `omni qa: posted` line, read whole, or null when there is none or it does not read. */
export function qaLine(log: string): QaPosted | null {
  const last = log
    .split('\n')
    .map((line) => line.trimEnd())
    .findLast((line) => line.includes(POSTED_PREFIX));
  const match = last === undefined ? null : POSTED.exec(last);
  if (match === null) return null;
  const [, round, word, count, issues, pr, url] = match;
  const bugs = issues?.split(' ').map((issue) => ({ issue: Number(issue.slice(1)) }));
  if (word !== 'pass' && Number(count) !== bugs?.length) return null;
  const verdict = QaVerdictSchema.safeParse(word === 'pass' ? { round: Number(round), verdict: 'pass' } : { round: Number(round), verdict: 'bugs', bugs });
  const posted = PrNumberSchema.safeParse(Number(pr));
  if (!verdict.success || !posted.success) return null;
  return { verdict: verdict.data, count: verdict.data.verdict === 'pass' ? 0 : verdict.data.bugs.length, pr: posted.data, url: COMMENT_URL.test(url) ? url : null };
}
