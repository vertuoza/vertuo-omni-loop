/**
 * **The Reviewer's verdict** (PRD 2871, s1): what `/omni:review` posts on a PRD's feature PR, checked
 * before anything is posted, so a review is never posted half-formed.
 *
 * ```json
 * { "round": 1, "verdict": "changes", "summary": "…",
 *   "findings": [{ "file": "kit/lib/x.ts", "line": 42, "severity": "major",
 *                  "rule": "default › Correctness", "problem": "…", "fix": "…" }] }
 * ```
 *
 * A verdict is `pass` (no finding) or `changes` (1 to 5 findings), in round 1 or 2: the Reviewer
 * blocks a pull request, so it keeps only the findings worth fixing, and argues two rounds at most
 * before a person decides. A finding names its file and line, a severity, the rule it breaks (a law
 * or rule id, a playbook form and section, or `default › <item>`), what is wrong and what would fix
 * it, each in one line.
 *
 * It renders as one GitHub review in `COMMENT` mode (approving is a person's): a summary body under
 * the marker `<!-- omni-review: <round> <verdict> -->`, which the kit reads back, and one inline
 * thread per finding on its file and line. Every part says an agent wrote it (L-AIACT-1). The same
 * verdict renders the same review, whatever order its findings came in: they are sorted, the most
 * severe first.
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';

/** The rounds a PRD's review may take: the Reviewer argues twice at most, then a person decides. */
const REVIEW_ROUNDS = 2;

/** At most this many findings in one verdict: precision over recall. */
const MAX_FINDINGS = 5;

/** The severities a finding may carry, the most severe first. */
const SEVERITIES = Object.freeze(['blocker', 'major', 'minor'] as const);

/** The two verdicts. */
const VERDICTS = Object.freeze(['pass', 'changes'] as const);

/** A verdict's name: `pass` or `changes`. */
export type VerdictName = (typeof VERDICTS)[number];

const ONE_LINE = 'one line';
const MAX_TEXT = 500;

/** A non-empty line of text, trimmed. */
const line = (what: string) =>
  z
    .string({ error: `${what}, as text` })
    .trim()
    .min(1, `${what}, never empty`)
    .max(MAX_TEXT, `${what}, at most ${String(MAX_TEXT)} characters`)
    .refine((text) => !text.includes('\n'), `${ONE_LINE}: ${what}`);

/** A path inside the repository, as git names it: relative, never climbing out. */
const RepoPathSchema = z
  .string({ error: 'the file the finding is on, a path from the repository root' })
  .trim()
  .min(1, 'the file the finding is on, never empty')
  .refine((path) => !path.startsWith('/') && !path.split('/').includes('..'), 'a path from the repository root, never absolute and never climbing out with ..');

const FindingSchema = z.strictObject({
  file: RepoPathSchema,
  line: z.number({ error: 'the line the finding is on, a whole number from 1' }).int('a whole number from 1').positive('a whole number from 1'),
  severity: z.enum(SEVERITIES, { error: `one of ${SEVERITIES.join(', ')}` }),
  rule: line('the rule it breaks: a law or rule id, a playbook form and section, or default › <item>'),
  problem: line('what is wrong'),
  fix: line('what would fix it'),
});

/** One finding: where, how bad, which rule, what is wrong and what would fix it. */
type Finding = z.infer<typeof FindingSchema>;

const VerdictSchema = z
  .strictObject({
    round: z.union([z.literal(1), z.literal(2)], { error: `the round, 1 to ${String(REVIEW_ROUNDS)}` }),
    verdict: z.enum(VERDICTS, { error: `one of ${VERDICTS.join(', ')}` }),
    summary: line('the summary').optional(),
    findings: z.array(FindingSchema).default([]),
  })
  .superRefine((verdict, context) => {
    const count = verdict.findings.length;
    if (verdict.verdict === 'pass' && count > 0) {
      context.addIssue({ code: 'custom', path: ['findings'], message: 'a pass holds no finding' });
    }
    if (verdict.verdict === 'changes' && (count === 0 || count > MAX_FINDINGS)) {
      context.addIssue({ code: 'custom', path: ['findings'], message: `a changes verdict holds 1 to ${String(MAX_FINDINGS)} findings, got ${String(count)}` });
    }
  });

/** A verdict, checked. */
export type Verdict = z.infer<typeof VerdictSchema>;

/** `parseVerdict`'s answer: the verdict, or one `<field>: <why>` line per refusal. */
export type ParsedVerdict = { ok: true; verdict: Verdict } | { ok: false; errors: string[] };

/** `input`, checked as a verdict: refused field by field, each line naming the field. */
export function parseVerdict(input: unknown): ParsedVerdict {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['(verdict): an object { round, verdict, findings }'] };
  }
  const parsed = VerdictSchema.safeParse(input);
  if (parsed.success) return { ok: true, verdict: parsed.data };
  return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.map(String).join('.') || '(verdict)'}: ${issue.message}`) };
}

/** The marker a review's body opens on. */
export function reviewMarker(round: number, verdict: VerdictName): string {
  return `<!-- omni-review: ${String(round)} ${verdict} -->`;
}

const MARKER_RE = /<!-- omni-review: (\d+) ([a-z]+) -->/;
const KNOWN_VERDICTS: readonly string[] = VERDICTS;
const isVerdictName = (value: string): value is VerdictName => KNOWN_VERDICTS.includes(value);

/** The round and verdict a review's body carries, or `null`: no marker, or one naming no round or verdict the kit knows. */
export function readReviewMarker(body: string | null | undefined): { round: number; verdict: VerdictName } | null {
  const match = MARKER_RE.exec(body ?? '');
  const round = Number(match?.[1]);
  const verdict = match?.[2] ?? '';
  if (!Number.isInteger(round) || round < 1 || round > REVIEW_ROUNDS || !isVerdictName(verdict)) return null;
  return { round, verdict };
}

/** One inline thread of a review, as GitHub's review API takes it. */
export type ReviewComment = { path: string; line: number; side: 'RIGHT'; body: string };

/** A review, rendered: its summary body and its threads. */
export type RenderedReview = { body: string; comments: ReviewComment[] };

/** Who wrote it, on every part of the review: an agent, never passing as a person (L-AIACT-1). */
const BYLINE = 'Reviewer · agent';

/** `Round 1 of 2: 2 findings`, or `Round 2 of 2: pass`. */
function summaryLine({ round, verdict, findings }: Verdict): string {
  const what = verdict === 'pass' ? 'pass' : `${String(findings.length)} finding${findings.length === 1 ? '' : 's'}`;
  return `Round ${String(round)} of ${String(REVIEW_ROUNDS)}: ${what}`;
}

const compare = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0);

/** The findings in the order they are shown: the most severe first, then by file, line and rule. */
function ordered(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
      compare(a.file, b.file) ||
      a.line - b.line ||
      compare(a.rule, b.rule) ||
      compare(a.problem, b.problem) ||
      compare(a.fix, b.fix),
  );
}

/** One finding's thread: its severity and rule, what is wrong, what would fix it, and who wrote it. */
function threadBody(finding: Finding, round: number): string {
  return [
    `**${finding.severity}** · ${finding.rule}`,
    '',
    finding.problem,
    '',
    `**Fix:** ${finding.fix}`,
    '',
    `_${BYLINE} · round ${String(round)} of ${String(REVIEW_ROUNDS)}_`,
  ].join('\n');
}

/**
 * `verdict` as one GitHub review: the body opens on its marker and names the round and the count,
 * lists the findings most severe first, says an agent wrote it, and ends with `footer` (the line
 * `omni sign footer` prints, `null` when signing is off); each finding is one thread on its file and
 * line, on the pull request's side of the diff.
 */
export function renderReview(verdict: Verdict, { footer }: { footer: string | null }): RenderedReview {
  const findings = ordered(verdict.findings);
  const lines = [reviewMarker(verdict.round, verdict.verdict), `**${summaryLine(verdict)}**`, ''];
  if (verdict.summary) lines.push(verdict.summary, '');
  if (findings.length) {
    findings.forEach((finding, index) => {
      lines.push(`${String(index + 1)}. **${finding.severity}** · \`${finding.file}:${String(finding.line)}\` · ${finding.rule}: ${finding.problem}`);
    });
    lines.push('');
  }
  lines.push(`_${BYLINE}: this review only comments. Approving and merging stay a person's._`);
  if (footer) lines.push('', footer);
  const comments = findings.map((finding): ReviewComment => ({ path: finding.file, line: finding.line, side: 'RIGHT', body: threadBody(finding, verdict.round) }));
  return { body: lines.join('\n'), comments };
}
