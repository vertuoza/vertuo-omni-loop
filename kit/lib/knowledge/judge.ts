/**
 * **The sweep** (PRD 1342, slice s6): `omni knowledge judge` asks `law-worth` of every rule and
 * invariant whose `Enforced by:` is `unenforced`, then edits the working tree. A "yes" pends on its
 * law issue (`Enforced by: pending #<n>`); a "no" leaves its register for its source PRD's ledger,
 * `Stays here: not worth a law (…)`; once every one is decided, `laws.requireProof: true`.
 *
 * Pure: every function here takes texts and returns texts. The command
 * (`kit/bin/commands/knowledge.ts`) asks the model and Jev, opens the issues and writes the files.
 */
import { z } from 'zod';
import { group } from '../narrow.ts';
import { ID_TOKEN, type KnowledgeEntry } from './registers.ts';
import { addLedgerLine, lawWorthNote, type LawIssue, type LawWorth } from './write.ts';
import { STAYS_HERE_FIELD } from './harvest.ts';
import type { Context } from '../context.ts';
import type { IssueNumber } from '../ids.ts';
import type { LawWorthState } from './pipeline.ts';

/** The `Enforced by:` value the sweep judges. */
const UNENFORCED = 'unenforced';

/** Every rule and invariant whose `Enforced by:` is `unenforced`, in register order. */
export function unenforcedLaws(entries: readonly KnowledgeEntry[]): KnowledgeEntry[] {
  return entries.filter((entry) => (entry.kind === 'rule' || entry.kind === 'invariant') && entry.enforcedBy === UNENFORCED);
}

/**
 * The state `law-worth` reads of one register entry: its statement, its `Why`, the principle it
 * serves (`<id>: <statement>`, the bare value when no entry has that id), its domain and its PRD's title.
 */
export function sweepState(entry: KnowledgeEntry, entries: readonly KnowledgeEntry[], prdTitle: string | null): LawWorthState {
  const served = entry.serves === null ? null : entries.find((other) => other.id === entry.serves);
  const principle = entry.serves === null ? null : served ? `${served.id}: ${served.statement}` : entry.serves;
  return { statement: entry.statement, why: entry.why, principle, domain: entry.domain, prdTitle };
}

/** The model's answer to "worth a law?", when Jev does not answer: the classifier's own. */
export const WorthReplySchema = z.object({ worthALaw: z.boolean(), reason: z.string().min(1).max(400) }).strict();

/** {@link WorthReplySchema} as the JSON schema the model is held to. */
export const WORTH_JSON_SCHEMA = {
  type: 'object',
  properties: { worthALaw: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['worthALaw', 'reason'],
  additionalProperties: false,
};

export const WORTH_SYSTEM =
  "You judge one law of a software product's knowledge base. Reply with one JSON object and nothing else.";

/** The question put to the model about one law, with the five fields `law-worth` reads. */
export function worthPrompt(state: LawWorthState): string {
  const or = (value: string | null) => value ?? 'none';
  return [
    'Is this rule worth a law: an executable test that fails when it is broken?',
    'Answer `worthALaw` true when breaking it would hurt the product or the people who rely on it, it holds for a long time and code can check it.',
    'Answer false for a one-off choice, a matter of taste, or a fact no test can see.',
    'Say why in `reason`, in one sentence.',
    '',
    `Statement: ${state.statement}`,
    `Why: ${or(state.why)}`,
    `Principle it serves: ${or(state.principle)}`,
    `Domain: ${or(state.domain)}`,
    `PRD: ${or(state.prdTitle)}`,
  ].join('\n');
}

/** Where a register entry's `Source:` says its decision was settled: the ledger and its entry. */
export function ledgerOf(source: string | null): { file: string; id: string } | null {
  const match = /^`?([^`,\s]*settled\.md)`?,\s*entry\s+`?([^`,\s]+)`?/.exec(source ?? '');
  return match ? { file: group(match, 1), id: group(match, 2) } : null;
}

/** The PRD a register entry's `Source:` names (`PRD #<n>`), `null` when none. */
export function prdOf(source: string | null): number | null {
  const match = /PRD #([1-9]\d*)/.exec(source ?? '');
  return match ? Number(group(match, 1)) : null;
}

/** The law issue the sweep opens for one "yes": `Law: <statement>`, naming the entry where it stands. */
export function lawIssueOf(entry: KnowledgeEntry): LawIssue {
  const source = entry.source ?? 'none';
  const body = [
    entry.statement,
    '',
    `- Entry: \`${entry.id}\``,
    `- Register: \`${entry.file}\``,
    `- Source: ${source}`,
    "- Its test: where the repository's testing form puts tests (`omni kb show testing`), beside the code that keeps the law.",
    '',
    'The sweep (`omni knowledge judge`) found this law with no test and judged it worth one. It reads `Enforced by: pending #<this issue>` until `/omni:enforce` writes its test, sees it fail with the law broken and pass restored, and names the test there.',
  ].join('\n');
  return { id: entry.id, entry: entry.id, register: entry.file, statement: entry.statement, source, title: `Law: ${entry.statement}`, body };
}

const HEADING = /^#{1,2}\s/;
const entryHeading = (id: string) => new RegExp(`^##\\s+${id}\\s*$`);

/** The lines of entry `id` in `lines`: `[start, end)`, from its heading to the next heading; `null` when absent. */
function entrySpan(lines: readonly string[], id: string): [number, number] | null {
  const start = lines.findIndex((line) => entryHeading(id).test(line));
  if (start === -1) return null;
  const next = lines.findIndex((line, index) => index > start && HEADING.test(line));
  return [start, next === -1 ? lines.length : next];
}

/** `text` with entry `id`'s `Enforced by: unenforced` turned to `pending #<issue>`; unchanged otherwise. */
export function pendLaw(text: string, id: string, issue: IssueNumber): string {
  const lines = text.split('\n');
  const span = entrySpan(lines, id);
  if (span === null) return text;
  for (let index = span[0]; index < span[1]; index += 1) {
    if (/^Enforced by:\s*unenforced\s*$/.test(lines[index] ?? '')) lines[index] = `Enforced by: pending #${issue}`;
  }
  return lines.join('\n');
}

/** `text` without entry `id`, its heading to the next; one blank line kept between what is left. */
export function removeEntry(text: string, id: string): string {
  const lines = text.split('\n');
  const span = entrySpan(lines, id);
  if (span === null) return text;
  const before = lines.slice(0, span[0]);
  const after = lines.slice(span[1]);
  while (before.length > 0 && (before.at(-1) ?? '').trim() === '') before.pop();
  const rest = after.length > 0 ? [...before, '', ...after] : [...before, ''];
  return rest.join('\n');
}

/** One citation of a removed id: the entry citing it (`null` outside any entry) and its file. */
export type Citation = { id: string; citedBy: string | null; file: string };

/** Each line of `text` with the entry it sits in: the id of the `##` heading above it, `null` outside one. */
function linesByEntry(text: string): { line: string; entry: string | null }[] {
  let current: string | null = null;
  return text.split('\n').map((line) => {
    const heading = /^##\s+(\S+)\s*$/.exec(line);
    if (heading) current = group(heading, 1);
    else if (HEADING.test(line)) current = null;
    return { line, entry: current };
  });
}

/** Every place in `files` that still cites one of `removed`, by the entry it sits in, in file order. */
export function citationsOf(files: readonly { path: string; text: string }[], removed: readonly string[]): Citation[] {
  const found = new Map<string, Citation>();
  for (const { path, text } of files) {
    for (const { line, entry } of linesByEntry(text)) {
      const cited = (line.match(ID_TOKEN) ?? []).filter((id) => removed.includes(id) && id !== entry);
      for (const id of cited) found.set(`${id} ${entry ?? ''} ${path}`, { id, citedBy: entry, file: path });
    }
  }
  return [...found.values()];
}

/**
 * The config's text with `laws.requireProof: true`: its line turned to true, or added first under
 * `laws:` at its children's indent. `null` when `laws:` is no block this can edit by line.
 */
export function requireProofText(text: string): string | null {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => /^laws:\s*(#.*)?$/.test(line));
  if (at === -1) return null;
  let end = lines.findIndex((line, index) => index > at && /^\S/.test(line));
  if (end === -1) end = lines.length;
  const child = lines.slice(at + 1, end).find((line) => /^\s+\S/.test(line) && !/^\s+#/.test(line));
  const indent = /^(\s+)/.exec(child ?? '')?.[1] ?? '  ';
  for (let index = at + 1; index < end; index += 1) {
    const match = /^(\s+requireProof:\s*)(\S+)(.*)$/.exec(lines[index] ?? '');
    if (match) {
      lines[index] = `${group(match, 1)}true${match[3] ?? ''}`;
      return lines.join('\n');
    }
  }
  lines.splice(at + 1, 0, `${indent}requireProof: true`);
  return lines.join('\n');
}

/** What counts for one swept law: the answer, and on a "yes" its law issue (`null` until opened). */
export type SweepVerdict = { worth: LawWorth; issue: IssueNumber | null };

/** What the sweep did to the config: set it, found it set, left it while a law is undecided, or could not edit it. */
export type RequireProof = 'set' | 'already' | 'undecided' | 'unreadable';

export type SweepResult = {
  writes: { path: string; text: string }[];
  /** Every "no" removed, with the ledger it was recorded in (`null`: none could be written). */
  removed: { id: string; ledger: string | null }[];
  citations: Citation[];
  requireProof: RequireProof;
};

/** The files the sweep reads and edits, each read once; `writes()` returns the ones changed. */
function editableFiles(read: (path: string) => string | null) {
  const original = new Map<string, string | null>();
  const texts = new Map<string, string | null>();
  const textOf = (path: string): string | null => {
    if (!texts.has(path)) {
      const text = read(path);
      original.set(path, text);
      texts.set(path, text);
    }
    return texts.get(path) ?? null;
  };
  /** Applies `change` to `path`'s text; false when the file is absent or `change` returns `null`. */
  const edit = (path: string, change: (text: string) => string | null): boolean => {
    const text = textOf(path);
    const changed = text === null ? null : change(text);
    if (changed !== null) texts.set(path, changed);
    return changed !== null;
  };
  const writes = () =>
    [...texts]
      .filter((pair): pair is [string, string] => pair[1] !== null && pair[1] !== original.get(pair[0]))
      .map(([path, text]) => ({ path, text }));
  return { textOf, edit, writes };
}

type Markers = Pick<Context['markers'], 'settledOpen' | 'settledClose'>;

/**
 * One law's verdict applied: a "yes" with its issue pends, a "no" leaves its register for its ledger
 * (the ledger written, or `null` when none could be). Returns the removal, `null` for a "yes".
 */
function applyVerdict(
  entry: KnowledgeEntry,
  verdict: SweepVerdict,
  { edit, markers }: { edit: ReturnType<typeof editableFiles>['edit']; markers: Markers },
): SweepResult['removed'][number] | null {
  const issue = verdict.issue;
  if (verdict.worth.worth) {
    if (issue !== null) edit(entry.file, (text) => pendLaw(text, entry.id, issue));
    return null;
  }
  edit(entry.file, (text) => removeEntry(text, entry.id));
  const ledger = ledgerOf(entry.source);
  if (ledger === null) return { id: entry.id, ledger: null };
  const line = `- ${STAYS_HERE_FIELD}: ${lawWorthNote(verdict.worth)}, was ${entry.id}`;
  const recorded = edit(ledger.file, (text) => addLedgerLine(text, { id: ledger.id, line, markers }));
  return { id: entry.id, ledger: recorded ? ledger.file : null };
}

/** Whether every law has a verdict the sweep could write: a "no", or a "yes" with its issue. */
const allDecided = (laws: readonly KnowledgeEntry[], verdicts: Readonly<Record<string, SweepVerdict>>): boolean =>
  laws.every((entry) => {
    const verdict = verdicts[entry.id];
    return verdict !== undefined && (!verdict.worth.worth || verdict.issue !== null);
  });

/** What to do with `laws.requireProof`, and the config's new text when it is to be set. */
function requireProofOf(config: { text: string } | null, decided: boolean): { state: RequireProof; text: string | null } {
  const text = config === null ? null : requireProofText(config.text);
  if (config === null || text === null) return { state: 'unreadable', text: null };
  if (!decided) return { state: 'undecided', text: null };
  return text === config.text ? { state: 'already', text: null } : { state: 'set', text };
}

/**
 * The sweep's edits, as data. `read` returns a file's text (`null` when absent); `verdicts` holds
 * the answer of each law decided, by id; `knowledgeFiles` every Markdown file to search for
 * citations; `config` the config file and its text, `null` when unreadable.
 */
export function sweepEdits({
  entries,
  read,
  verdicts,
  markers,
  knowledgeFiles,
  config,
}: {
  entries: readonly KnowledgeEntry[];
  read: (path: string) => string | null;
  verdicts: Readonly<Record<string, SweepVerdict>>;
  markers: Markers;
  knowledgeFiles: readonly string[];
  config: { file: string; text: string } | null;
}): SweepResult {
  const files = editableFiles((path) => (config !== null && path === config.file ? config.text : read(path)));
  const laws = unenforcedLaws(entries);
  const removed = laws.flatMap((entry) => {
    const verdict = verdicts[entry.id];
    const gone = verdict ? applyVerdict(entry, verdict, { edit: files.edit, markers }) : null;
    return gone ? [gone] : [];
  });
  const proof = requireProofOf(config, allDecided(laws, verdicts));
  const proofText = proof.text;
  if (config !== null && proofText !== null) files.edit(config.file, () => proofText);
  const searched = knowledgeFiles.flatMap((path) => {
    const text = files.textOf(path);
    return text === null ? [] : [{ path, text }];
  });
  return { writes: files.writes(), removed, citations: citationsOf(searched, removed.map((entry) => entry.id)), requireProof: proof.state };
}
