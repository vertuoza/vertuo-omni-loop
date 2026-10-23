/**
 * **The rewind's findings** (PRD 2410, s5): what `/omni:rewind` found about why a PRD broke main, as the
 * file `omni rewind push --file` reads and the page's endpoint receives. Pure, zod only, so the kit and
 * the page's app share one contract.
 *
 * A finding names the check it came from (the break itself, then the seven checks), where the break
 * started, what happened, the links it stands on (at least one, https) and the fix. `checkFindings`
 * refuses, naming the finding by its place in the file, one with no evidence link, an origin other than
 * `repository`, `omni-setup` or `knowledge`, or a check other than the eight. Evidence is kept sorted and
 * without repeats, so two findings with the same check, origin and evidence are the same finding.
 */
import { z } from 'zod';
import { isOneOf } from '../narrow.ts';

export const REWIND_CHECKS = ['main', 'reviews', 'ci', 'bodies', 'waves', 'plan', 'spec', 'knowledge'] as const;

export const REWIND_ORIGINS = ['repository', 'omni-setup', 'knowledge'] as const;


/** One finding as it is pushed. */
export const RewindFindingSchema = z.strictObject({
  check: z.enum(REWIND_CHECKS),
  origin: z.enum(REWIND_ORIGINS),
  happened: z.string().trim().min(1).max(4000),
  evidence: z.array(z.string().max(500).regex(/^https:\/\/\S+$/, 'an https link')).min(1).max(20),
  fix: z.string().trim().min(1).max(4000),
});
export type RewindFinding = z.infer<typeof RewindFindingSchema>;

/** A finding's evidence as it is kept: sorted, each link once. */
const evidenceOf = (links: readonly string[]): string[] => [...new Set(links)].sort();

/** What makes two findings of a PRD one: the check, the origin and the evidence. */
export const findingKey = (finding: { check: string; origin: string; evidence: readonly string[] }): string =>
  JSON.stringify([finding.check, finding.origin, evidenceOf(finding.evidence)]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The place of a finding in the file, as a reader counts it. */
const named = (at: number) => `finding ${String(at + 1)}`;

/** What is wrong with a finding's check, origin or evidence, as the words that follow its name, or null. */
function headProblemOf(item: Record<string, unknown>): string | null {
  if (!isOneOf(REWIND_CHECKS, item.check)) return `: check must be one of ${REWIND_CHECKS.join(', ')}.`;
  if (!isOneOf(REWIND_ORIGINS, item.origin)) return `: origin must be one of ${REWIND_ORIGINS.join(', ')}.`;
  return Array.isArray(item.evidence) && item.evidence.length > 0 ? null : ': no evidence link. A finding stands on at least one https link.';
}

/** What is wrong with one finding of the file, as the words that follow its name, or null. */
function problemOf(item: unknown): string | null {
  if (!isRecord(item)) return ' is not an object.';
  const head = headProblemOf(item);
  if (head !== null) return head;
  const parsed = RewindFindingSchema.safeParse(item);
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  return `: ${issue?.path.join('.') ?? 'it'} is malformed: ${issue?.message ?? 'see omni help rewind'}.`;
}

/** The findings a file holds, or the first refusal, naming the finding. */
export function checkFindings(sent: unknown): { ok: true; findings: RewindFinding[] } | { ok: false; error: string } {
  const list = isRecord(sent) && 'findings' in sent ? sent.findings : sent;
  if (!Array.isArray(list) || list.length === 0) return { ok: false, error: 'the file holds no finding: give a JSON array of findings, or {"findings": [...]}.' };
  const findings: RewindFinding[] = [];
  for (const [at, item] of list.entries()) {
    const problem = problemOf(item);
    if (problem !== null) return { ok: false, error: `${named(at)}${problem}` };
    const finding = RewindFindingSchema.parse(item);
    const seen = findings.findIndex((f) => findingKey(f) === findingKey(finding));
    if (seen >= 0) return { ok: false, error: `${named(at)} repeats ${named(seen)}: the same check, origin and evidence.` };
    findings.push({ ...finding, evidence: evidenceOf(finding.evidence) });
  }
  return { ok: true, findings };
}
