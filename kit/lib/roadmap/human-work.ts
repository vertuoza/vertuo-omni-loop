/**
 * **A roadmap's human work** (PRD 1217, slice s1): every piece of work across a roadmap's PRDs that
 * only a person can do, as `omni roadmap push` sends it in its body's `humanWork`. Four sources:
 *
 * - `question`: a `person` row of the roadmap's open questions with no answer yet;
 * - `outbox`: an open outbox item ranked `human-action` or `high` on the PRD's open feature branch;
 * - `park`: the `- loop: parked · <why> · <link>` line of the PRD's feature PR's status comment;
 * - `clarification`: the latest `/omni:plan` needs-clarification comment on the PRD's issue (it opens
 *   with {@link CLARIFICATION_MARKER}) posted after the PRD's last plan commit, or with no plan yet.
 *
 * Settled work is simply not read: the app marks a key missing from a push as done. Each entry
 * carries the kind {@link ruleKind} works out from its words, so the list reads whole even when the
 * app's classifier is off. Pure: already-read inputs in, entries out.
 */
import type { PrdNumber } from '../ids.ts';
import type { OutboxItem } from '../types.ts';
import type { Roadmap } from './parse.ts';

/** The four kinds of human work, the closed set the app's classifier answers in. */
const HUMAN_WORK_KINDS = ['business', 'development', 'dev-ops', 'delivery-ops'] as const;
export type HumanWorkKind = (typeof HUMAN_WORK_KINDS)[number];

/** Where a piece of human work was read. */
export type HumanWorkSource = 'question' | 'outbox' | 'park' | 'clarification';

/** One piece of human work, as the push sends it. `prd` is null for a roadmap question that blocks
 * no PRD; `act` is what a person does, word for word, when the source says it; `url` is where it is
 * answered. */
export type HumanWorkEntry = {
  key: string;
  prd: PrdNumber | null;
  repo: string;
  source: HumanWorkSource;
  text: string;
  act: string | null;
  url: string | null;
  ruleKind: HumanWorkKind;
};

/** The line `/omni:plan`'s needs-clarification comment opens with, so the push finds it. */
export const CLARIFICATION_MARKER = '<!-- omni-needs-clarification -->';

/** Outbox ranks a person must act on: a medium decision is adopted, never asked. */
const HUMAN_RANKS = new Set(['human-action', 'high']);

/** Rule 2: a right missing in the repository. Words whole, case-insensitive, a plural allowed. */
const DEV_OPS = /\b(?:secret|token|scope|permission|grant|access|branch protection)(?:e?s)?\b/i;

/** Rule 3: putting the roadmap in production. Same matching as {@link DEV_OPS}. */
const DELIVERY_OPS = /\b(?:deploy|production|prod|migration run|console|environment variable)s?\b/i;

/** The kind the rules give a piece of human work: a question is business; then a missing right is
 * dev-ops, tried before a production step, which is delivery-ops; anything else is development. */
export function ruleKind(source: HumanWorkSource, text: string, act: string | null): HumanWorkKind {
  if (source === 'question') return 'business';
  const words = `${text}\n${act ?? ''}`;
  if (DEV_OPS.test(words)) return 'dev-ops';
  if (DELIVERY_OPS.test(words)) return 'delivery-ops';
  return 'development';
}

/** An entry with its rule kind worked out. */
const entry = (fields: Omit<HumanWorkEntry, 'ruleKind'>): HumanWorkEntry =>
  ({ ...fields, ruleKind: ruleKind(fields.source, fields.text, fields.act) });

/** A text on one line, trimmed; null when nothing is left. */
const flat = (text: string | null | undefined): string | null => {
  const line = (text ?? '').replace(/\s+/g, ' ').trim();
  return line || null;
};

/** A recommendation cell that gives none, as the push reads it. */
const NO_RECOMMENDATION = /^(?:|-|–|—|none)$/i;

/** Each unanswered `person` question of the roadmap: its PRD is the first row it blocks, its link the
 * roadmap's issue, where it is answered. */
export function questionWork(
  roadmap: Pick<Roadmap, 'questions' | 'prds'>,
  answers: ReadonlyMap<string, string>,
  { repo, issueUrl }: { repo: string; issueUrl: string | null },
): HumanWorkEntry[] {
  const prdOf = new Map(roadmap.prds.map((row) => [row.id, row.prd] as const));
  return roadmap.questions
    .filter((q) => q.kind === 'person' && !answers.has(q.id))
    .map((q) => {
      const recommendation = q.recommendation.trim();
      const first = q.blocks.find((id) => prdOf.has(id));
      return entry({
        key: `question:${q.id}`,
        prd: first === undefined ? null : prdOf.get(first) ?? null,
        repo,
        source: 'question',
        text: flat(q.question) ?? q.id,
        act: NO_RECOMMENDATION.test(recommendation) ? null : recommendation,
        url: issueUrl,
      });
    });
}

/** What an outbox item reads as in the list: its plain question, else its plain decision, else what
 * it had to decide, else its id. */
function itemText(item: OutboxItem): string {
  const { questionPlain, decisionPlain, whatIHadToDecide } = item.sections;
  return flat(questionPlain) ?? flat(decisionPlain) ?? flat(whatIHadToDecide) ?? item.id;
}

/** Each open outbox item of PRD `prd` a person must act on (`human-action` or `high`): a human-action
 * item's act is its `What a person must do`, word for word. `repoOf` names the repository of the
 * item's slice; `url` is the feature PR the item is answered on. */
export function outboxWork(
  prd: PrdNumber,
  items: readonly OutboxItem[],
  { repoOf, url }: { repoOf: (item: OutboxItem) => string; url: string | null },
): HumanWorkEntry[] {
  return items.filter((item) => HUMAN_RANKS.has(item.rank)).map((item) => entry({
    key: `outbox:${prd}/${item.id}`,
    prd,
    repo: repoOf(item),
    source: 'outbox',
    text: itemText(item),
    act: item.rank === 'human-action' ? item.sections.personSteps?.trim() || null : null,
    url,
  }));
}

/** A `- loop: parked · <why> · <link>` line; the link is optional. */
const PARK_LINE = /^\s*-\s*loop:\s*parked\s*·\s*(.+?)\s*$/m;

/** The why and the link of a status comment's park line, or null when it has none. */
export function parkOf(body: string): { why: string; link: string | null } | null {
  const line = PARK_LINE.exec(body)?.[1];
  if (line === undefined) return null;
  const parts = line.split('·').map((part) => part.trim());
  const last = parts.at(-1) ?? '';
  const link = parts.length > 1 && /^https?:\/\/\S+$/.test(last) ? last : null;
  const why = flat((link === null ? parts : parts.slice(0, -1)).join(' · '));
  return why === null ? null : { why, link };
}

/** PRD `prd`'s park, read from its feature PR's status comment (`status`, its body), linking the
 * feature PR, or its park line's own link with no PR; none when the PRD is not parked. */
export function parkWork(
  prd: PrdNumber,
  status: string | null,
  { repo, prUrl }: { repo: string; prUrl: string | null },
): HumanWorkEntry[] {
  const park = status === null ? null : parkOf(status);
  if (park === null) return [];
  return [entry({ key: `park:${prd}`, prd, repo, source: 'park', text: park.why, act: null, url: prUrl ?? park.link })];
}

/** A comment of an issue, as the push reads it. */
export type DatedComment = { body: string; url: string | null; createdAt: string };

/** A numbered question line: `1. …` or `1) …`. */
const NUMBERED = /^\s*\d+[.)]\s+(.+)$/;

/** The questions a needs-clarification comment asks: its numbered lines, or else its first line
 * after the marker. */
function clarificationQuestions(body: string): string[] {
  const lines = body.slice(body.indexOf(CLARIFICATION_MARKER) + CLARIFICATION_MARKER.length).split(/\r?\n/);
  const numbered = lines.flatMap((line) => {
    const question = flat(NUMBERED.exec(line)?.[1]);
    return question === null ? [] : [question];
  });
  if (numbered.length > 0) return numbered;
  const first = lines.map((line) => flat(line)).find((line) => line !== null);
  return first ? [first] : [];
}

/** PRD `prd`'s open clarification: the latest comment of its issue opening with the marker, posted
 * after `planAt` (its last plan commit), or any with no plan yet. Its text is the first question, its
 * act the others, one per line. */
export function clarificationWork(
  prd: PrdNumber,
  comments: readonly DatedComment[],
  { repo, planAt }: { repo: string; planAt: string | null },
): HumanWorkEntry[] {
  const after = planAt === null ? null : Date.parse(planAt);
  const marked = comments
    .filter((comment) => comment.body.trimStart().startsWith(CLARIFICATION_MARKER))
    .filter((comment) => after === null || Number.isNaN(after) || Date.parse(comment.createdAt) > after)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const latest = marked.at(-1);
  if (latest === undefined) return [];
  const [text, ...rest] = clarificationQuestions(latest.body);
  if (text === undefined) return [];
  return [entry({
    key: `clarification:${prd}`,
    prd,
    repo,
    source: 'clarification',
    text,
    act: rest.length > 0 ? rest.join('\n') : null,
    url: latest.url,
  })];
}
