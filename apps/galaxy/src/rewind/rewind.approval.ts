import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { LINE_MAX } from 'omni-loop/kit/lib/runner/line.ts';
import { CHECK_LABELS, ORIGIN_LABELS } from './rewind.contract';

// What Approve sends, by where a finding started (PRD 2410, s7; the spec's "What Approve does"). Pure: the
// service carries the plan out once the database recorded the decision.
//
// - `repository`: queues `/omni:bug-fix <the finding>` on a runner, sent by the member who approved.
// - `knowledge`, about a glossary term or a Legal entry: files a product knowledge proposal, for the
//   kind's owner to decide. A glossary finding names its term in backticks or quotes, a Legal one its code
//   as `L-<CODE>`; the fix's own words are the meaning or the statement, and the owner reads them before
//   anything is written.
// - `knowledge`, anything else (a playbook form, a register, or a glossary or Legal finding naming no term
//   or code): queues `/omni:knowledge-add <the finding>`, sent by the member.
// - `omni-setup`: opens one issue on the kit's repository holding the card's words (its check, where it
//   started, what happened and its fix); its evidence links stay in the workspace (constituent never#5).
//
// A runner's line takes letters, digits, spaces and `._/:#-` only, 200 characters at most
// (kit/lib/runner/line.ts), so `/omni:bug-fix '<the finding>'` cannot be sent as the spec words it: the
// finding goes as a description with every other character dropped and cut at a word, prefixed with the
// PRD it came from (settled item s7-01).

/** The line every finding's fix ends with (kit/plugin/skills/rewind/SKILL.md, settled item s6-03). */
export const AGENT_LINE = 'Written by an agent (/omni:rewind), not by a person.';

/** The kit's own repository, where an Omni-setup finding's issue opens. */
export const KIT_REPOSITORY = 'vertuoza/vertuo-omni-loop';

/** A finding as Approve reads it: what the card shows, and the PRD it belongs to. */
export type ApprovedFinding = {
  check: string;
  origin: string;
  happened: string;
  evidence: readonly string[];
  fix: string;
  repository: string;
  prd: PrdNumber;
};

export type GlossaryFields = { term: string; meaning: string };
export type LegalFields = { code: string; statement: string; source: string };

/** What Approve sends for one finding. */
export type ApprovalPlan =
  | { kind: 'job'; skill: 'bug-fix' | 'knowledge-add'; line: string }
  | { kind: 'proposal'; knowledge: 'glossary'; fields: GlossaryFields }
  | { kind: 'proposal'; knowledge: 'legal'; fields: LegalFields }
  | { kind: 'issue'; title: string; body: string };

/** A plan that files a product knowledge proposal. */
export type KnowledgeProposal = Extract<ApprovalPlan, { kind: 'proposal' }>;

/** The product's limits on a proposal's fields (supabase/migrations/20261212110000_product_knowledge.sql). */
const TERM_MAX = 80;
const MEANING_MAX = 400;
const SOURCE_MAX = 500;
const TITLE_MAX = 120;

const RUNNER_REFUSED = /[^A-Za-z0-9 ._/:#-]+/g;

/** `text` on one line, its runs of space made one. */
const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** `text` cut to `max` characters at a word, or mid-word when one word is longer. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head).trimEnd();
}

/** The fix without the agent's closing line: the line a job or a proposal carries. */
const fixOf = (fix: string): string => oneLine(fix.replace(AGENT_LINE, ''));

/** The line a runner runs for `skill`, carrying `text` as a description it takes. */
export function runnerLine(skill: 'bug-fix' | 'knowledge-add', prd: PrdNumber, text: string): string {
  const head = `/omni:${skill} rewind of PRD ${String(prd)}: `;
  const words = oneLine(text.replace(RUNNER_REFUSED, ' ').replace(/-{2,}/g, '-'));
  return `${head}${cut(words, LINE_MAX - head.length)}`;
}

/** The term a glossary finding names, in backticks or quotes; null when it names none. */
function termOf(fix: string): string | null {
  const named = /`([^`\n]{1,80})`|"([^"\n]{1,80})"|“([^”\n]{1,80})”/.exec(fix);
  const term = oneLine(named?.[1] ?? named?.[2] ?? named?.[3] ?? '');
  return term === '' ? null : term.slice(0, TERM_MAX);
}

/** The Legal code a finding names as `L-<CODE>`; null when it names none. */
const codeOf = (fix: string): string | null => /\bL-([A-Z][A-Z0-9]{0,39})\b/.exec(fix)?.[1] ?? null;

function knowledgePlan(finding: ApprovedFinding): ApprovalPlan {
  const fix = fixOf(finding.fix);
  const code = codeOf(fix);
  if (code !== null && /\bLegal\b|\bL-[A-Z]/.test(fix)) {
    const source = cut(`The rewind of PRD ${String(finding.prd)}: ${finding.evidence.join(' ')}`, SOURCE_MAX);
    return { kind: 'proposal', knowledge: 'legal', fields: { code, statement: cut(fix, MEANING_MAX), source } };
  }
  const term = /\bglossary\b/i.test(fix) ? termOf(fix) : null;
  if (term !== null) return { kind: 'proposal', knowledge: 'glossary', fields: { term, meaning: cut(fix, MEANING_MAX) } };
  return { kind: 'job', skill: 'knowledge-add', line: runnerLine('knowledge-add', finding.prd, fix) };
}

const labelOf = (labels: Readonly<Record<string, string>>, key: string): string => labels[key] ?? key;

/** The issue an Omni-setup finding opens: the card's words, without its evidence links. */
function issuePlan(finding: ApprovedFinding): ApprovalPlan {
  const happened = finding.happened.trim();
  const head = `${labelOf(CHECK_LABELS, finding.check)} · Started in: ${labelOf(ORIGIN_LABELS, finding.origin)}`;
  return {
    kind: 'issue',
    title: `Rewind: ${cut(oneLine(happened.split('\n')[0] ?? ''), TITLE_MAX - 'Rewind: '.length)}`,
    body: `${head}\n\n${happened}\n\nFix: ${finding.fix.trim()}\n`,
  };
}

/** What Approve sends for `finding`. */
export function approvalOf(finding: ApprovedFinding): ApprovalPlan {
  if (finding.origin === 'omni-setup') return issuePlan(finding);
  if (finding.origin === 'knowledge') return knowledgePlan(finding);
  return { kind: 'job', skill: 'bug-fix', line: runnerLine('bug-fix', finding.prd, finding.happened) };
}

/** What in `text` would name the workspace outside it: its repository, named or linked on GitHub; null when
 * nothing does, and always null in the kit's own repository, where the issue opens at home. */
export function leakOf(text: string, repository: string): string | null {
  const repo = repository.toLowerCase();
  if (repo === KIT_REPOSITORY) return null;
  const lower = text.toLowerCase();
  if (lower.includes(repo)) return repo;
  const owner = repo.split('/')[0] ?? repo;
  return lower.includes(`github.com/${owner}`) ? `github.com/${owner}` : null;
}
