// @ts-nocheck
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
 * `Source:` naming the ledger file and the entry's id, `Enforced by: unenforced` on every rule and
 * invariant, and `Proposed: harvest <date>` on every entry from an adopted decision and on every
 * new principle. A record's `Status:` is `accepted` when a person answered, `adopted` otherwise.
 *
 * Reads the working tree through `ctx` and touches no file: the result is data,
 * `{ writes: [{ path, text }], placed, notPlaced }`. {@link applyKnowledgeWrites} writes it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readDecisions } from '../playbook/decisions.ts';
import { ADOPTED_VERDICT } from '../outbox/settle.ts';
import { NEW_PRINCIPLE, PRODUCT_PLACE } from './classify.ts';
import { BECAME_FIELD, STAYS_HERE_FIELD } from './harvest.ts';
import { PRODUCT_CODE, codeOf, domainsDir, idParts, productDir, readKnowledge } from './registers.ts';

/** Who proposes every entry the harvest writes unconfirmed: `Proposed: harvest <date>`. */
export const HARVEST_PROPOSER = 'harvest';

/** The longest slug a record's file name takes, cut at a word. */
const SLUG_MAX = 64;

const PREFIX = { principle: 'P', rule: 'BR', invariant: 'N' };
const LAYER = { principle: 'principles.md', rule: 'rules.md', invariant: 'invariants.md' };
const NONE_YET = /^None yet\./;

const day = (value) => String(value ?? '').slice(0, 10);
const handle = (who) => (String(who).startsWith('@') ? String(who) : `@${who}`);
const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Whether a person answered the decision: agreed, or drifted and reworked since. */
export function answeredByPerson(candidate) {
  if (candidate.verdict === 'agreed') return true;
  return candidate.verdict === 'drifted' && /^yes\b/.test(candidate.closed ?? '');
}

/**
 * The `Decided:` value of a candidate, in one of three forms: `@<answerer> via <channel>, <date>`,
 * `nobody — adopted when raised (medium), <date>`, or `@<merger> — merged over a red outbox, <date>`.
 */
export function decidedLine(candidate) {
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
export function mergedLine(merge) {
  return `${handle(merge.by)}, ${day(merge.at)}, PR #${merge.pr}`;
}

/** A record's file-name slug: the title lowercased, words joined by hyphens, cut at a word. */
export function slugOf(title) {
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
function chosenOption(candidate) {
  if (candidate.verdict === 'drifted') {
    const answer = (candidate.answer ?? '').trim();
    return answer ? `The answer, as it was given: ${answer}` : null;
  }
  const option = candidate.item?.sections?.options?.[0];
  return option ? `The option chosen: ${option.letter}. ${option.text}` : null;
}

function sectionOf(candidate, key) {
  return (candidate.item?.sections?.[key] ?? '').trim() || '(not recorded)';
}

/** Numbers the ids of one run: past the tree, past `taken`, past what the run handed out. */
function makeNumbering({ ctx, taken }) {
  const highest = new Map();
  const bump = (key, n) => highest.set(key, Math.max(highest.get(key) ?? 0, Number(n)));
  for (const entry of readKnowledge({ ctx }).entries) {
    const parts = idParts(entry.id);
    if (parts && parts.codes.length === 1) bump(`${parts.type}-${parts.codes[0]}`, parts.n);
  }
  for (const id of taken.ids ?? []) {
    const parts = idParts(id);
    if (parts && parts.codes.length === 1) bump(`${parts.type}-${parts.codes[0]}`, parts.n);
  }
  let record = Number(readDecisions({ ctx }).next) - 1;
  for (const number of taken.records ?? []) record = Math.max(record, Number(String(number).replace(/^ADR-/, '')));
  return {
    entry(kind, code) {
      const key = `${PREFIX[kind]}-${code}`;
      const n = (highest.get(key) ?? 0) + 1;
      highest.set(key, n);
      return `${key}-${n}`;
    },
    record() {
      record += 1;
      return String(record).padStart(4, '0');
    },
  };
}

/** Where a place's layer file lives, and the code its ids carry. */
function placeOf(ctx, place) {
  if (place === PRODUCT_PLACE) return { dir: productDir(ctx), code: PRODUCT_CODE, title: 'Product' };
  const title = place.charAt(0).toUpperCase() + place.slice(1).replace(/-/g, ' ');
  return { dir: `${domainsDir(ctx)}/${place}`, code: codeOf(place), title };
}

/** The file texts of one run, read once from the tree and edited in memory. */
function makeFiles(ctx) {
  const texts = new Map();
  return {
    read(path) {
      if (!texts.has(path)) {
        const absolute = join(ctx.root, path);
        texts.set(path, existsSync(absolute) ? readFileSync(absolute, 'utf8') : null);
      }
      return texts.get(path);
    },
    write(path, text) {
      texts.set(path, text);
      this.changed.add(path);
    },
    changed: new Set(),
    writes() {
      return [...this.changed].map((path) => ({ path, text: texts.get(path) }));
    },
  };
}

/** A layer file with one entry appended; its "None yet." paragraph goes with the first one. */
function appendEntry(text, entry, { heading }) {
  let base = text ?? `# ${heading}\n`;
  if (!/^## /m.test(base)) {
    const lines = base.split('\n');
    const start = lines.findIndex((line) => NONE_YET.test(line));
    if (start !== -1) {
      let end = start;
      while (end < lines.length && lines[end].trim() !== '') end += 1;
      lines.splice(start, end - start);
      base = lines.join('\n');
    }
  }
  base = `${base.replace(/\s+$/, '')}\n\n`;
  return `${base}${entry}`;
}

function sourceLine(candidate, ledgerFile, prd) {
  return `${ledgerFile}, entry ${candidate.id}, PRD #${prd}`;
}

function renderRegisterEntry({ id, statement, fields }) {
  return [`## ${id}`, '', oneLine(statement), '', ...fields.map(([key, value]) => `${key}: ${value}`), ''].join('\n');
}

function renderRecord({ number, reply, candidate, status, decided, merged, merge, prd, ledgerFile }) {
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
export function addLedgerLine(text, { id, line, markers }) {
  const lines = text.split('\n');
  const open = lines.lastIndexOf(markers.settledOpen(id));
  if (open === -1) return null;
  const close = lines.indexOf(markers.settledClose(id), open);
  const end = close === -1 ? lines.length : close;
  let at = -1;
  for (let index = open + 1; index < end; index += 1) {
    if (/^- [A-Za-z][A-Za-z ]*: /.test(lines[index])) at = index;
    else if (at !== -1) break;
  }
  if (at === -1) return null;
  lines.splice(at + 1, 0, line);
  return lines.join('\n');
}

/**
 * Turns classified candidates into file edits.
 *
 * @param {{
 *   ctx: object,
 *   classified: { candidate: object, reply: object | null, reason?: string }[],
 *   merge: { by: string, at: string, pr: number, url?: string },
 *   taken?: { records?: string[], ids?: string[] },
 *   date: string,
 * }} input `reply` is what `classificationSchema` accepted, `null` when there is none (`reason`
 *   says why: the candidate is then not placed). `taken` holds the record numbers and register ids
 *   the open knowledge branches already use. `date` is the harvest's day, for `Proposed:`.
 * @returns {{ writes: { path: string, text: string }[],
 *   placed: { id, kind, landedAs: string[], files: string[], ledgerFile, ledgerLine, decided,
 *     status: string | null, proposed: boolean, reason }[],
 *   notPlaced: { id: string, reason: string }[] }}
 */
export function writeKnowledge({ ctx, classified, merge, taken = {}, date }) {
  const files = makeFiles(ctx);
  const numbering = makeNumbering({ ctx, taken });
  const merged = mergedLine(merge);
  const proposedLine = `${HARVEST_PROPOSER} ${date}`;
  const placed = [];
  const notPlaced = [];

  for (const { candidate, reply, reason } of classified) {
    if (!reply) {
      notPlaced.push({ id: candidate.id, reason: reason ?? 'not classified' });
      continue;
    }
    const ledgerFile = candidate.ledgerFile;
    const prd = candidate.item?.prd ?? null;
    const answered = answeredByPerson(candidate);
    const decided = decidedLine(candidate);
    const proposed = !answered;
    const touched = [];
    let landedAs = [];
    let status = null;

    if (reply.kind === 'adr') {
      const number = numbering.record();
      status = answered ? 'accepted' : ADOPTED_VERDICT;
      const path = `${ctx.layout.adrDir.replace(/\/+$/, '')}/${number}-${slugOf(reply.title)}.md`;
      files.write(path, renderRecord({ number, reply, candidate, status, decided, merged, merge, prd, ledgerFile }));
      touched.push(path);
      landedAs = [`ADR-${number}`];
    } else if (reply.kind === 'rule' || reply.kind === 'invariant') {
      const place = placeOf(ctx, reply.place);
      const source = sourceLine(candidate, ledgerFile, prd);
      const id = numbering.entry(reply.kind, place.code);
      let serves = reply.serves ?? null;
      let principleId = null;
      if (reply.kind === 'rule' && serves === NEW_PRINCIPLE) {
        principleId = numbering.entry('principle', place.code);
        serves = principleId;
      }
      const fields = [
        ...(serves ? [['Serves', serves]] : []),
        ['Source', source],
        ['Enforced by', 'unenforced'],
        ['Stated', day(merge.at)],
        ['Decided', decided],
        ['Merged', merged],
        ...(proposed ? [['Proposed', proposedLine]] : []),
      ];
      const path = `${place.dir}/${LAYER[reply.kind]}`;
      files.write(
        path,
        appendEntry(files.read(path), renderRegisterEntry({ id, statement: reply.statement, fields }), {
          heading: `${place.title} ${reply.kind}s`,
        }),
      );
      touched.push(path);
      landedAs = [id];
      if (principleId) {
        const principlePath = `${place.dir}/${LAYER.principle}`;
        const principle = renderRegisterEntry({
          id: principleId,
          statement: reply.principle.statement,
          fields: [
            ['Why', oneLine(reply.principle.why)],
            ['Source', source],
            ['Merged', merged],
            ['Proposed', proposedLine],
          ],
        });
        files.write(principlePath, appendEntry(files.read(principlePath), principle, { heading: `${place.title} principles` }));
        touched.push(principlePath);
        landedAs.push(principleId);
      }
    } else if (reply.kind === 'covered') {
      landedAs = [reply.covers];
    }

    const ledgerLine =
      reply.kind === 'stays-here'
        ? `- ${STAYS_HERE_FIELD}: ${oneLine(reply.reason)}`
        : `- ${BECAME_FIELD}: ${landedAs.join(', ')}`;
    const ledger = files.read(ledgerFile);
    const withLine = ledger === null ? null : addLedgerLine(ledger, { id: candidate.id, line: ledgerLine, markers: ctx.markers });
    if (withLine === null) {
      notPlaced.push({ id: candidate.id, reason: `no ledger entry for ${candidate.id} in ${ledgerFile}` });
      continue;
    }
    files.write(ledgerFile, withLine);
    placed.push({
      id: candidate.id,
      kind: reply.kind,
      landedAs,
      files: touched,
      ledgerFile,
      ledgerLine,
      decided,
      status,
      proposed: proposed && (reply.kind === 'rule' || reply.kind === 'invariant' || reply.kind === 'adr'),
      reason: oneLine(reply.reason),
    });
  }

  return { writes: files.writes(), placed, notPlaced };
}

/** Writes `writes` (a {@link writeKnowledge} result's) into the working tree at `ctx.root`. */
export function applyKnowledgeWrites({ ctx, writes }) {
  for (const { path, text } of writes) {
    const absolute = join(ctx.root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, text);
  }
}
