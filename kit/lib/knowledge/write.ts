/**
 * **Decisions written as knowledge** (PRD #82, slice s5). The model classifies; code writes. This
 * module takes classified harvest candidates (`harvestCandidates` entries, each with the reply
 * `classificationSchema` accepted) and turns them into file edits:
 *
 * - an `adr` becomes a decision record, `NNNN-<slug>.md` in `ctx.layout.adrDir`, shaped by the
 *   decisions form, with `Decided:` and `Merged:` on its status line and a `## Source` section;
 * - a `rule` or an `invariant` is appended to its place's layer file (`product/` or an existing
 *   domain); a rule serving `new` appends the principle it proposes to the same place;
 * - `covered` and `stays-here` write no knowledge file;
 * - every placed candidate's ledger entry gets `- Became: <id>[, <id>]` or `- Stays here: <reason>`,
 *   on its **latest** entry for that id. A candidate that is not placed gets no line.
 *
 * **Ids** go one past the highest in use in the working tree and in `taken` — the numbers and ids
 * the open knowledge branches already hold — and past every id this run hands out.
 *
 * **Provenance** is the same everywhere: `Decided:` in one of three forms (who answered, nobody,
 * or the merger over a red outbox), `Merged:` naming who merged, when and which pull request,
 * `Source:` naming the ledger file and the entry's id, `Enforced by:` on every rule and invariant,
 * and `Proposed: harvest <date>` on every entry from an adopted decision and on every new principle.
 *
 * **Enforced by** (PRD 1171): the model proposes the proof, code keeps only what it can check. A
 * path the reply's `enforcedBy` names is kept when the feature pull request changed it (added,
 * modified or renamed: `changed`) **and** it exists in the tree; the kept paths are written
 * comma-separated, or `unenforced` when none is kept. Every other path is dropped with its reason
 * ({@link proofOf}), and the caller reports it. A record's `Status:` is `accepted` when a person answered, `adopted` otherwise.
 *
 * Reads the working tree through `ctx` and touches no file: the result is data,
 * `{ writes: [{ path, text }], placed, notPlaced }`. {@link applyKnowledgeWrites} writes it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readDecisions } from '../playbook/decisions.ts';
import { ADOPTED_VERDICT } from '../outbox/settle.ts';
import type { Context } from '../context.ts';
import { NEW_PRINCIPLE, PRODUCT_PLACE, type ClassificationReply, type ItemSections } from './classify.ts';
import { defined } from '../narrow.ts';
import { plainText } from '../outbox/plain-text.ts';
import { BECAME_FIELD, STAYS_HERE_FIELD } from './harvest.ts';
import { PRODUCT_CODE, codeOf, domainsDir, idParts, productDir, readKnowledge, type EntryKind } from './registers.ts';
import type { IssueNumber, PrNumber, PrdNumber } from '../ids.ts';

/** The merge a harvest runs after: who merged, when, and which pull request. */
export type Merge = { by: string; at: string; pr: PrNumber; url?: string };

/** The record numbers and register ids the open knowledge branches already hold. */
export type Taken = { records?: readonly (string | number)[]; ids?: readonly string[] };

/** What writing reads of a candidate (a `harvestCandidates` entry). */
export type WriteCandidate = {
  id: string;
  ledgerFile: string | null;
  item?: { prd?: PrdNumber | null; sections?: ItemSections | null } | null;
  answer?: string | null;
  verdict?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  channel?: string | null;
  closed?: string | null;
};

/** One file the feature pull request changed: its path (a rename's new one) and GitHub's status. */
export type ChangedFile = { path: string; status: string };

/** The statuses whose path the pull request leaves in the tree: a kept proof may name one. */
export const KEPT_STATUSES: readonly string[] = Object.freeze(['added', 'modified', 'renamed']);

/** A proposed proof the writer did not keep, and why. */
export type DroppedPath = { path: string; reason: string };

/**
 * The answer to `law-worth` (PRD 1342) that counts for one rule or invariant: worth a law or not, who
 * decided (`classifier`, or `Jev` when its answer counted) and Jev's confidence (`null` for the classifier).
 */
export type LawWorth = { worth: boolean; decidedBy: string; confidence: number | null };

/**
 * A law issue to open before its entry is written `Enforced by: pending #<n>` (PRD 1342): the entry's
 * id, its register, its statement and source, and the issue's title and body. `id` is the candidate's.
 */
export type LawIssue = { id: string; entry: string; register: string; statement: string; source: string; title: string; body: string };

/**
 * One classified candidate: the reply `classificationSchema` accepted, or why there is none, and the
 * `law-worth` answer that counts when Jev decided (none: the reply's own `worthALaw`).
 */
export type Classified = {
  candidate: WriteCandidate;
  reply: ClassificationReply | null;
  reason?: string | null | undefined;
  worth?: LawWorth | null | undefined;
};

/** A candidate that landed: what it became, which files it touched, and its ledger line. */
export type Placed = {
  id: string;
  kind: ClassificationReply['kind'];
  landedAs: string[];
  files: string[];
  ledgerFile: string;
  ledgerLine: string;
  decided: string;
  status: string | null;
  proposed: boolean;
  reason: string;
  /** A rule's or an invariant's kept proof, as written on `Enforced by:`; none means `unenforced`. */
  enforcedBy?: string[];
  /** A rule's or an invariant's proposed proof the writer did not keep, each with its reason. */
  dropped?: DroppedPath[];
  /** A rule or an invariant with no test kept: the `law-worth` answer, and its law issue on a "yes". */
  law?: LawWorth & { issue: IssueNumber | null };
};

/** What {@link writeKnowledge} returns: the files to write, and where every candidate landed. */
export type WriteResult = {
  writes: { path: string; text: string }[];
  placed: Placed[];
  notPlaced: { id: string; reason: string }[];
  /** The law issues to open first: every "yes" with no issue in `lawIssues` (PRD 1342). */
  lawIssues: LawIssue[];
};

/** A ledger's markers, as the context carries them. */
type Markers = Context['markers'];

/** What writing reads of the context: the checkout, its layout and its markers. */
type WriteCtx = {
  root: string;
  layout: { knowledgeRoot: string; adrDir: string };
  markers: Markers;
};

/** Why a "yes" is not placed until its law issue is open (PRD 1342). */
const LAW_ISSUE_FIRST = 'its law issue opens first';

/** The decider of a `law-worth` answer read from the reply's own `worthALaw`. */
const CLASSIFIER = 'classifier';

/** Who proposes every entry the harvest writes unconfirmed: `Proposed: harvest <date>`. */
export const HARVEST_PROPOSER = 'harvest';

/** The longest slug a record's file name takes, cut at a word. */
const SLUG_MAX = 64;

const PREFIX: Record<EntryKind, string> = { principle: 'P', rule: 'BR', invariant: 'N' };
const LAYER: Record<EntryKind, string> = { principle: 'principles.md', rule: 'rules.md', invariant: 'invariants.md' };
const NONE_YET = /^None yet\./;

const day = (value: unknown): string => plainText(value).slice(0, 10);
const handle = (who: unknown): string => (String(who).startsWith('@') ? String(who) : `@${String(who)}`);
const oneLine = (value: unknown): string => plainText(value).replace(/\s+/g, ' ').trim();

/** Whether a person answered the decision: agreed, or drifted and reworked since. */
export function answeredByPerson(candidate: Pick<WriteCandidate, 'verdict' | 'closed'>): boolean {
  if (candidate.verdict === 'agreed') return true;
  return candidate.verdict === 'drifted' && /^yes\b/.test(candidate.closed ?? '');
}

/**
 * The `Decided:` value of a candidate, in one of three forms: `@<answerer> via <channel>, <date>`,
 * `nobody — adopted when raised (medium), <date>`, or `@<merger> — merged over a red outbox, <date>`.
 */
export function decidedLine(candidate: Pick<WriteCandidate, 'verdict' | 'approvedAt' | 'approvedBy' | 'channel'>): string {
  const when = day(candidate.approvedAt);
  if (candidate.verdict === ADOPTED_VERDICT) {
    if (candidate.approvedBy === null || candidate.approvedBy === 'nobody') {
      return `nobody — adopted when raised (medium), ${when}`;
    }
    return `${handle(candidate.approvedBy)} — merged over a red outbox, ${when}`;
  }
  return `${handle(candidate.approvedBy)} via ${candidate.channel}, ${when}`;
}

/** The `Merged:` value: `@<merger>, <date>, PR #<n>`. */
export function mergedLine(merge: Merge): string {
  return `${handle(merge.by)}, ${day(merge.at)}, PR #${merge.pr}`;
}

/** A record's file-name slug: the title lowercased, words joined by hyphens, cut at a word. */
export function slugOf(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= SLUG_MAX) return slug;
  const cut = slug.slice(0, SLUG_MAX + 1);
  return cut.slice(0, cut.lastIndexOf('-') > 0 ? cut.lastIndexOf('-') : SLUG_MAX);
}

/**
 * The option chosen, verbatim: option A (what was built) for a decision kept as built; for a drift
 * reworked since, the answer that asked for the change, as it was given. `null` when neither exists.
 */
function chosenOption(candidate: WriteCandidate): string | null {
  if (candidate.verdict === 'drifted') {
    const answer = (candidate.answer ?? '').trim();
    return answer ? `The answer, as it was given: ${answer}` : null;
  }
  const option = candidate.item?.sections?.options?.[0];
  return option ? `The option chosen: ${option.letter}. ${option.text}` : null;
}

function sectionOf(candidate: WriteCandidate, key: 'whatIHadToDecide' | 'whatItCostsToChangeLater'): string {
  return (candidate.item?.sections?.[key] ?? '').trim() || '(not recorded)';
}

/**
 * Which of `proposed` the writer keeps as proof (PRD 1171): a path `changed` lists with a kept status
 * and that `exists`. The rest are dropped, once each, with the reason: `not changed by #<pr>`,
 * `removed by #<pr>`, or `no longer in the tree`. Pure but for `exists`.
 */
function proofOf({
  proposed = [],
  changed,
  pr,
  exists,
}: {
  proposed?: readonly string[] | undefined;
  changed: readonly ChangedFile[];
  pr: PrNumber;
  exists: (path: string) => boolean;
}): { kept: string[]; dropped: DroppedPath[] } {
  const status = new Map(changed.map((file) => [file.path, file.status]));
  const kept: string[] = [];
  const dropped: DroppedPath[] = [];
  for (const path of new Set(proposed.map((p) => p.trim()))) {
    const given = status.get(path);
    if (given === 'removed') dropped.push({ path, reason: `removed by #${pr}` });
    else if (!KEPT_STATUSES.includes(given ?? '')) dropped.push({ path, reason: `not changed by #${pr}` });
    else if (!exists(path)) dropped.push({ path, reason: 'no longer in the tree' });
    else kept.push(path);
  }
  return { kept, dropped };
}

/** Numbers the ids of one run: past the tree, past `taken`, past what the run handed out. */
function makeNumbering({ ctx, taken }: { ctx: WriteCtx; taken: Taken }): {
  entry: (kind: EntryKind, code: string) => string;
  record: () => string;
} {
  const highest = new Map<string, number>();
  const bump = (key: string, n: string) => highest.set(key, Math.max(highest.get(key) ?? 0, Number(n)));
  for (const id of [...readKnowledge({ ctx }).entries.map((entry) => entry.id), ...(taken.ids ?? [])]) {
    const parts = idParts(id);
    if (parts && parts.codes.length === 1) bump(`${parts.type}-${parts.codes[0]}`, parts.n);
  }
  let record = Number(readDecisions({ ctx }).next) - 1;
  for (const number of taken.records ?? []) record = Math.max(record, Number(String(number).replace(/^ADR-/, '')));
  return {
    entry(kind: EntryKind, code: string): string {
      const key = `${PREFIX[kind]}-${code}`;
      const n = (highest.get(key) ?? 0) + 1;
      highest.set(key, n);
      return `${key}-${n}`;
    },
    record(): string {
      record += 1;
      return String(record).padStart(4, '0');
    },
  };
}

/** Where a place's layer file lives, and the code its ids carry. */
function placeOf(ctx: WriteCtx, place: string): { dir: string; code: string; title: string } {
  if (place === PRODUCT_PLACE) return { dir: productDir(ctx), code: PRODUCT_CODE, title: 'Product' };
  const title = place.charAt(0).toUpperCase() + place.slice(1).replace(/-/g, ' ');
  return { dir: `${domainsDir(ctx)}/${place}`, code: codeOf(place), title };
}

/** The file texts of one run, read once from the tree and edited in memory. */
type Files = {
  read(path: string): string | null;
  write(path: string, text: string): void;
  changed: Set<string>;
  writes(): { path: string; text: string }[];
};

function makeFiles(ctx: WriteCtx): Files {
  const texts = new Map<string, string | null>();
  return {
    read(path: string): string | null {
      if (!texts.has(path)) {
        const absolute = join(ctx.root, path);
        texts.set(path, existsSync(absolute) ? readFileSync(absolute, 'utf8') : null);
      }
      return texts.get(path) ?? null;
    },
    write(path: string, text: string): void {
      texts.set(path, text);
      this.changed.add(path);
    },
    changed: new Set(),
    writes() {
      return [...this.changed].map((path) => ({ path, text: texts.get(path) ?? '' }));
    },
  };
}

/** A layer file with one entry appended; its "None yet." paragraph goes with the first one. */
function appendEntry(text: string | null, entry: string, { heading }: { heading: string }): string {
  let base = text ?? `# ${heading}\n`;
  if (!/^## /m.test(base)) {
    const lines = base.split('\n');
    const start = lines.findIndex((line) => NONE_YET.test(line));
    if (start !== -1) {
      let end = start;
      while (end < lines.length && (lines[end] ?? '').trim() !== '') end += 1;
      lines.splice(start, end - start);
      base = lines.join('\n');
    }
  }
  base = `${base.replace(/\s+$/, '')}\n\n`;
  return `${base}${entry}`;
}

function sourceLine(candidate: WriteCandidate, ledgerFile: string, prd: PrdNumber | null): string {
  return `${ledgerFile}, entry ${candidate.id}, PRD #${prd}`;
}

function renderRegisterEntry({ id, statement, fields }: { id: string; statement: string; fields: [string, string][] }): string {
  return [`## ${id}`, '', oneLine(statement), '', ...fields.map(([key, value]) => `${key}: ${value}`), ''].join('\n');
}

function renderRecord({
  number,
  reply,
  candidate,
  status,
  decided,
  merged,
  merge,
  prd,
  ledgerFile,
}: {
  number: string;
  reply: Extract<ClassificationReply, { kind: 'adr' }>;
  candidate: WriteCandidate;
  status: string;
  decided: string;
  merged: string;
  merge: Merge;
  prd: PrdNumber | null;
  ledgerFile: string;
}): string {
  const option = chosenOption(candidate);
  return [
    `# ADR-${number} — ${oneLine(reply.title)}`,
    '',
    `**Status:** ${status} · **Date:** ${day(merge.at)} · **PRD:** #${prd} · **Decided:** ${decided} · **Merged:** ${merged}`,
    '',
    '## Context',
    '',
    sectionOf(candidate, 'whatIHadToDecide'),
    '',
    '## Decision',
    '',
    oneLine(reply.statement),
    '',
    ...(option ? [option, ''] : []),
    '## Consequences',
    '',
    sectionOf(candidate, 'whatItCostsToChangeLater'),
    '',
    '## Source',
    '',
    `\`${ledgerFile}\`, entry \`${candidate.id}\``,
    '',
  ].join('\n');
}

/**
 * The ledger's text with `line` added to the LATEST entry for `id`, right after its list of
 * `- Field:` lines. `null` when the ledger holds no entry for that id.
 */
export function addLedgerLine(text: string, { id, line, markers }: { id: string; line: string; markers: Pick<Markers, 'settledOpen' | 'settledClose'> }): string | null {
  const lines = text.split('\n');
  const open = lines.lastIndexOf(markers.settledOpen(id));
  if (open === -1) return null;
  const close = lines.indexOf(markers.settledClose(id), open);
  const end = close === -1 ? lines.length : close;
  let at = -1;
  for (let index = open + 1; index < end; index += 1) {
    if (/^- [A-Za-z][A-Za-z ]*: /.test(lines[index] ?? '')) at = index;
    else if (at !== -1) break;
  }
  if (at === -1) return null;
  lines.splice(at + 1, 0, line);
  return lines.join('\n');
}

/** What writing one rule or invariant needs of its run. */
type EntryRun = {
  /** The `Enforced by:` value to write. */
  enforced: string;
  /** False to number the entry (and its principle) without writing either: a held-back "yes". */
  write: boolean;
  ctx: WriteCtx;
  files: Files;
  numbering: ReturnType<typeof makeNumbering>;
  reply: Extract<ClassificationReply, { kind: 'rule' | 'invariant' }>;
  candidate: WriteCandidate;
  source: string;
  decided: string;
  merged: string;
  merge: Merge;
  /** Whether the entry is proposed: no person answered its decision. A new principle always is. */
  proposed: boolean;
  /** `harvest <date>`. */
  proposedLine: string;
};

/** The `Serves:` of a rule, and the id of the principle it proposes when it serves `new`; none for an invariant. */
function servedBy(
  reply: EntryRun['reply'],
  nextPrinciple: () => string,
): { serves: string | null; principleId: string | null } {
  if (reply.kind !== 'rule') return { serves: null, principleId: null };
  if (reply.serves !== NEW_PRINCIPLE) return { serves: reply.serves, principleId: null };
  const principleId = nextPrinciple();
  return { serves: principleId, principleId };
}

/** The `Enforced by:` value of the kept proof: the paths comma-separated, or `unenforced`. */
const enforcedValue = (kept: readonly string[]): string => (kept.length > 0 ? kept.join(', ') : 'unenforced');

/**
 * Appends one rule or invariant to its place's layer file, `enforced` on `Enforced by:`, and the
 * principle a rule serving `new` proposes beside it. With `write` false it only numbers them.
 */
function writeRegisterEntry({
  ctx,
  files,
  numbering,
  reply,
  candidate,
  source,
  decided,
  merged,
  merge,
  proposed,
  proposedLine,
  enforced,
  write,
}: EntryRun): { touched: string[]; landedAs: string[]; path: string } {
  const place = placeOf(ctx, reply.place);
  const id = numbering.entry(reply.kind, place.code);
  const { serves, principleId } = servedBy(reply, () => numbering.entry('principle', place.code));
  const path = `${place.dir}/${LAYER[reply.kind]}`;
  if (!write) return { touched: [], landedAs: [id, ...(principleId ? [principleId] : [])], path };
  const fields: [string, string][] = [
    ...(serves ? [['Serves', serves] satisfies [string, string]] : []),
    ['Source', source],
    ['Enforced by', enforced],
    ['Stated', day(merge.at)],
    ['Decided', decided],
    ['Merged', merged],
    ...(proposed ? [['Proposed', proposedLine] satisfies [string, string]] : []),
  ];
  files.write(
    path,
    appendEntry(files.read(path), renderRegisterEntry({ id, statement: reply.statement, fields }), {
      heading: `${place.title} ${reply.kind}s`,
    }),
  );
  if (!principleId) return { touched: [path], landedAs: [id], path };
  const principlePath = writeProposedPrinciple({ files, place, id: principleId, reply, candidate, source, merged, proposedLine });
  return { touched: [path, principlePath], landedAs: [id, principleId], path };
}

/** Appends the principle a rule serving `new` proposes to its place's principles; returns that file. */
function writeProposedPrinciple({
  files,
  place,
  id,
  reply,
  candidate,
  source,
  merged,
  proposedLine,
}: Pick<EntryRun, 'files' | 'reply' | 'candidate' | 'source' | 'merged' | 'proposedLine'> & {
  place: { dir: string; title: string };
  id: string;
}): string {
  const proposal = defined(reply.kind === 'rule' ? reply.principle : undefined, `the principle ${candidate.id} proposes`); // classificationSchema refuses serves "new" without the principle it proposes
  const path = `${place.dir}/${LAYER.principle}`;
  const principle = renderRegisterEntry({
    id,
    statement: proposal.statement,
    fields: [
      ['Why', oneLine(proposal.why)],
      ['Source', source],
      ['Merged', merged],
      ['Proposed', proposedLine],
    ],
  });
  files.write(path, appendEntry(files.read(path), principle, { heading: `${place.title} principles` }));
  return path;
}

/** The `Stays here:` note of a "no": `not worth a law (<decided by>[ <score>])`. */
export function lawWorthNote(worth: LawWorth): string {
  const score = worth.confidence === null ? '' : ` ${worth.confidence.toFixed(2)}`;
  return `not worth a law (${worth.decidedBy}${score})`;
}

/** The body of a law issue: the entry, its register, its statement, its source and where its test would live. */
function lawIssueBody({ entry, register, statement, source }: Omit<LawIssue, 'id' | 'title' | 'body'>): string {
  return [
    statement,
    '',
    `- Entry: \`${entry}\``,
    `- Register: \`${register}\``,
    `- Source: ${source}`,
    "- Where its test would live: where the repository's testing form puts tests (`omni kb show testing`), beside the code that keeps the law.",
    '',
    'The law is written `Enforced by: pending #<this issue>` until `/omni:enforce` writes its test, sees it red with the law broken and green restored, and names the test there.',
  ].join('\n');
}

/**
 * Which of the three paths a rule or an invariant takes (PRD 1342): `proven` when a kept path proves
 * it, else the `law-worth` answer that counts (Jev's when given, else the reply's `worthALaw`), or
 * `legacy` when there is none (a reply from before `worthALaw`): written `unenforced`, as before.
 */
function lawPath(
  kept: readonly string[],
  worth: LawWorth | null | undefined,
  worthALaw: boolean | undefined,
): { path: 'proven' | 'legacy' } | { path: 'yes' | 'no'; worth: LawWorth } {
  if (kept.length > 0) return { path: 'proven' };
  const counted = worth ?? (worthALaw === undefined ? null : { worth: worthALaw, decidedBy: CLASSIFIER, confidence: null });
  if (counted === null) return { path: 'legacy' };
  return { path: counted.worth ? 'yes' : 'no', worth: counted };
}

/**
 * Turns classified candidates into file edits. `reply` is what `classificationSchema` accepted,
 * `null` when there is none (`reason` says why: the candidate is then not placed). `taken` holds the
 * record numbers and register ids the open knowledge branches already use. `date` is the harvest's
 * day, for `Proposed:`.
 */
export function writeKnowledge({
  ctx,
  classified,
  merge,
  taken = {},
  date,
  changed = [],
  lawIssues = {},
}: {
  ctx: WriteCtx;
  classified: readonly Classified[];
  merge: Merge;
  taken?: Taken | undefined;
  date: string;
  /** The files the feature pull request changed (PRD 1171); none keeps every proposed proof out. */
  changed?: readonly ChangedFile[] | undefined;
  /** The law issue already open for a "yes", by candidate id (PRD 1342). */
  lawIssues?: Readonly<Record<string, IssueNumber>> | undefined;
}): WriteResult {
  const files = makeFiles(ctx);
  const numbering = makeNumbering({ ctx, taken });
  const merged = mergedLine(merge);
  const proposedLine = `${HARVEST_PROPOSER} ${date}`;
  const placed: Placed[] = [];
  const notPlaced: { id: string; reason: string }[] = [];
  const toOpen: LawIssue[] = [];

  for (const { candidate, reply, reason, worth } of classified) {
    if (!reply) {
      notPlaced.push({ id: candidate.id, reason: reason ?? 'not classified' });
      continue;
    }
    const ledgerFile = defined(candidate.ledgerFile, `the ledger of ${candidate.id}`); // harvestCandidates always names the ledger it read
    const prd = candidate.item?.prd ?? null;
    const answered = answeredByPerson(candidate);
    const decided = decidedLine(candidate);
    const run = { ctx, files, numbering, candidate, decided, merged, merge, proposed: !answered, proposedLine };
    let landing: Landing;
    if (reply.kind === 'adr') {
      const number = numbering.record();
      const status = answered ? 'accepted' : ADOPTED_VERDICT;
      const path = `${ctx.layout.adrDir.replace(/\/+$/, '')}/${number}-${slugOf(reply.title)}.md`;
      files.write(path, renderRecord({ number, reply, candidate, status, decided, merged, merge, prd, ledgerFile }));
      landing = { kind: 'adr', touched: [path], landedAs: [`ADR-${number}`], status, note: null, extra: {} };
    } else if (reply.kind === 'rule' || reply.kind === 'invariant') {
      const landed = landLaw({ ...run, reply, source: sourceLine(candidate, ledgerFile, prd), changed, worth, issue: lawIssues[candidate.id] ?? null });
      if ('heldBack' in landed) {
        toOpen.push(landed.heldBack);
        notPlaced.push({ id: candidate.id, reason: LAW_ISSUE_FIRST });
        continue;
      }
      landing = landed;
    } else {
      const note = reply.kind === 'stays-here' ? oneLine(reply.reason) : null;
      landing = { kind: reply.kind, touched: [], landedAs: reply.kind === 'covered' ? [reply.covers] : [], status: null, note, extra: {} };
    }

    const ledgerLine = landing.note === null ? `- ${BECAME_FIELD}: ${landing.landedAs.join(', ')}` : `- ${STAYS_HERE_FIELD}: ${landing.note}`;
    const ledger = files.read(ledgerFile);
    const withLine = ledger === null ? null : addLedgerLine(ledger, { id: candidate.id, line: ledgerLine, markers: ctx.markers });
    if (withLine === null) {
      notPlaced.push({ id: candidate.id, reason: `no ledger entry for ${candidate.id} in ${ledgerFile}` });
      continue;
    }
    files.write(ledgerFile, withLine);
    placed.push({
      id: candidate.id,
      kind: landing.kind,
      landedAs: landing.landedAs,
      files: landing.touched,
      ledgerFile,
      ledgerLine,
      decided,
      status: landing.status,
      proposed: !answered && PROPOSABLE.includes(landing.kind),
      reason: oneLine(reply.reason),
      ...landing.extra,
    });
  }

  return { writes: files.writes(), placed, notPlaced, lawIssues: toOpen };
}

/** The kinds whose entry carries `Proposed:` when no person answered its decision. */
const PROPOSABLE: readonly string[] = ['rule', 'invariant', 'adr'];

/**
 * Where one reply landed: its kind as placed, the files it touched, its ids, a record's status, the
 * `Stays here:` note (none: a `Became:` line) and the fields a rule or an invariant adds.
 */
type Landing = {
  kind: Placed['kind'];
  touched: string[];
  landedAs: string[];
  status: string | null;
  note: string | null;
  extra: Pick<Placed, 'enforcedBy' | 'dropped' | 'law'>;
};

/**
 * One rule or invariant down its path (PRD 1342): `proven` and `legacy` are written with their kept
 * proof (or `unenforced`), a "no" becomes a `not worth a law` note, a "yes" is written
 * `pending #<issue>` — or, with no issue open yet, numbered and held back as the law issue to open.
 */
function landLaw({
  reply,
  changed,
  worth,
  issue,
  ...run
}: Omit<EntryRun, 'enforced' | 'write'> & {
  changed: readonly ChangedFile[];
  worth: LawWorth | null | undefined;
  issue: IssueNumber | null;
}): Landing | { heldBack: LawIssue } {
  const { ctx, merge, candidate, source } = run;
  const proof = proofOf({ proposed: reply.enforcedBy, changed, pr: merge.pr, exists: (path) => existsSync(join(ctx.root, path)) });
  const chosen = lawPath(proof.kept, worth, reply.worthALaw);
  if (chosen.path === 'no') {
    const law = { ...chosen.worth, issue: null };
    return { kind: 'stays-here', touched: [], landedAs: [], status: null, note: lawWorthNote(chosen.worth), extra: { law } };
  }
  const yes = chosen.path === 'yes';
  const write = !yes || issue !== null;
  const entry = writeRegisterEntry({ ...run, reply, enforced: issue === null ? enforcedValue(proof.kept) : `pending #${issue}`, write });
  if (!write) {
    const at = { entry: defined(entry.landedAs[0], `the id of ${candidate.id}`), register: entry.path, statement: oneLine(reply.statement), source };
    return { heldBack: { id: candidate.id, ...at, title: `Law: ${at.statement}`, body: lawIssueBody(at) } };
  }
  const extra = { enforcedBy: proof.kept, dropped: proof.dropped, ...(yes ? { law: { ...chosen.worth, issue } } : {}) };
  return { kind: reply.kind, touched: entry.touched, landedAs: entry.landedAs, status: null, note: null, extra };
}

/** Writes `writes` (a {@link writeKnowledge} result's) into the working tree at `ctx.root`. */
export function applyKnowledgeWrites({ ctx, writes }: { ctx: { root: string }; writes: readonly { path: string; text: string }[] }): void {
  for (const { path, text } of writes) {
    const absolute = join(ctx.root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, text);
  }
}
