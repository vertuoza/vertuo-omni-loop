/**
 * **An outbox item is a typed thing** (PRD #985, slice s2) — the guard. **A settled item's
 * `Became:` ids must resolve, and no open item may sit inside a shipped PRD** (Task 7).
 *
 * Grades every open item under every dir `ctx.layout.outboxDirs()` names, through the one parser
 * in `outbox.mjs`. Five things must hold for an open item, each failing with the file and a reason
 * a human can act on:
 *
 * 1. The item parses at all: well-formed front matter, the four required sections, in order, each
 *    with content. `parseOutboxItem` already names exactly which piece is wrong (which malformed
 *    field, or which section is missing).
 * 2. `bears-on` resolves — to `none`, a real ADR, or a real entry in the knowledge folder
 *    (whenever one exists, whatever `ctx.config.laws.source` says). An id nothing can find is a promise the item cannot keep. Delegated
 *    entirely to the injected `laws` (`laws.mjs`, Task 4).
 * 3. `rank` is never below the floor its `bears-on` sets. A decision bearing on an invariant or a
 *    business rule that only claims `medium` is exactly the failure `isBelowFloor` exists to
 *    catch, also delegated to `laws`.
 * 4. **Every open item carries its two plain-words sections**, first, before the four sections
 *    above — and **a `high` or `medium` item carries two to four lettered options**, `A`, `B`,
 *    `C`… in order, each one plain; a `human-action` item needs none of that, since there is
 *    nothing to choose between.
 * 5. **An open item's intro and punchline, when it carries them** (PRD #50, slice s1), are each
 *    plain and at most 120 characters long (`funLineProblems`). The pair stays optional: an item
 *    raised before PRD #50 carries neither, and the pull request's outbox comment fills in for it.
 *
 * Two more things hold across the whole outbox, not just one item at a time:
 *
 * 6. **Every `Became:` id a `settled.md` carries resolves.** A settled entry that names a
 *    knowledge id nothing claims is exactly as broken as an open item whose `bears-on` does not
 *    resolve — the same failure, noticed later, on the ledger instead of the open file. A process
 *    lesson becomes a playbook section, `playbook/<form>#<slot>` (PRD #45): it resolves when that
 *    form's file holds the slot and the slot is not blank.
 * 7. **No open item sits inside a shipped PRD's outbox.** Once a PRD's folder moves to `shipped`,
 *    every item still open under its `outbox/` is a promise nobody is reading any more: settle it,
 *    or reopen the PRD. Such a file is not also graded against 1–5 — one violation per shipped
 *    open item is enough.
 *
 * An empty outbox tree (no PRD has ever raised an item) passes trivially — this slice builds the
 * outbox, it does not use it.
 *
 * Pure rule, unit-tested in `check-outbox.test.mjs`; `kit/bin` (Task 15) is the CLI half.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/check-outbox.mjs — changes in kit/porting/outbox--check-outbox.md.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readRepoFile } from '../check-report.ts';
import type { Context } from '../context.ts';
import { lawsFor } from '../laws.ts';
import type { Laws } from '../laws.ts';
import type { OutboxOption, OutboxSections } from '../types.ts';
import { isPlaybookId, resolvePlaybookId } from '../playbook/forms.ts';
import {
  SETTLED_FILE,
  funLineProblems,
  isBelowFloor,
  optionLettersInOrder,
  outboxItemFiles,
  plainWordsProblems,
  resolveBearsOn,
} from './outbox.ts';
import { parseItem, parseSettledEntries } from './settle.ts';

/** Ranks that need two to four lettered options — a `human-action` item needs none. */
const RANKS_NEEDING_OPTIONS: readonly string[] = ['high', 'medium'];

/** The plain-words section, and the field `parseOutboxItem` reports it under. */
const PLAIN_SECTION_FIELDS: { heading: string; field: keyof OutboxSections & ('questionPlain' | 'decisionPlain') }[] = [
  { heading: 'The question, in plain words', field: 'questionPlain' },
  { heading: 'The decision, in plain words', field: 'decisionPlain' },
];

/** The intro and the punchline, and the field `parseOutboxItem` reports each under. */
const FUN_SECTION_FIELDS: { heading: string; field: keyof OutboxSections & ('introFun' | 'punchlineFun') }[] = [
  { heading: 'The intro, for fun', field: 'introFun' },
  { heading: 'The punchline, for fun', field: 'punchlineFun' },
];

/** One `file: detail` line — the one format every violation in this module is printed as. */
function describe(file: string, detail: string): string {
  return `${file}: ${detail}`;
}

/**
 * Grades one already-read item file's text. Returns a list of `${file}: <reason>` violation
 * lines — empty when the item is entirely well-formed.
 *
 * `ctx` is accepted for parity with the option bag {@link findOutboxViolations} threads through to
 * every call, but is not itself read here: everything this function needs from the repository
 * (whether `bears-on` resolves, whether it floors the rank) already lives in `laws`.
 */
export function checkItemText(
  file: string,
  text: string,
  { laws }: { ctx?: unknown; laws: Laws },
): string[] {
  const parsed = parseItem(text, file);
  if (!parsed.ok) return parsed.errors;

  const { item } = parsed;
  const violations: string[] = [];

  const resolved = resolveBearsOn(item.bearsOn, laws);
  if (!resolved.ok) {
    violations.push(
      describe(
        file,
        `bears-on "${item.bearsOn}" does not resolve to any invariant, business rule, or ADR.`,
      ),
    );
  }

  if (isBelowFloor(item.bearsOn, item.rank, laws)) {
    violations.push(
      describe(
        file,
        `rank "${item.rank}" is below the floor bears-on "${item.bearsOn}" sets — a decision bearing on an invariant or a business rule floors at "high".`,
      ),
    );
  }

  if (item.sections.questionPlain === undefined && item.sections.decisionPlain === undefined) {
    violations.push(
      describe(
        file,
        'missing "## The question, in plain words" and "## The decision, in plain words" — every open item needs both, first, before the existing four sections.',
      ),
    );
  } else {
    for (const { heading, field } of PLAIN_SECTION_FIELDS) {
      for (const problem of plainWordsProblems(item.sections[field])) {
        violations.push(describe(file, `"## ${heading}" ${problem}`));
      }
    }
  }

  // Optional, unlike the plain words: the parser has already refused one without the other.
  for (const { heading, field } of FUN_SECTION_FIELDS) {
    if (item.sections[field] === undefined) continue;
    for (const problem of funLineProblems(item.sections[field])) {
      violations.push(describe(file, `"## ${heading}" ${problem}`));
    }
  }

  if (RANKS_NEEDING_OPTIONS.includes(item.rank)) {
    violations.push(...optionsViolations(file, item.sections.options));
  }

  return violations;
}

/** The options-section violations for one `high` or `medium` item — `[]` when it holds up. */
function optionsViolations(file: string, options: readonly OutboxOption[] | undefined): string[] {
  const list = options ?? [];

  if (list.length < 2 || list.length > 4) {
    return [
      describe(
        file,
        `carries ${list.length} option(s) under "## The options, in plain words" — a high or medium item needs two to four, "A." the option built.`,
      ),
    ];
  }

  if (!optionLettersInOrder(list)) {
    return [
      describe(
        file,
        `options are lettered ${list.map((option) => option.letter).join(', ')} — a high or medium item needs "A", "B", "C"… in order, with no gap and no repeat.`,
      ),
    ];
  }

  return list.flatMap((option) =>
    plainWordsProblems(option.text).map((problem) =>
      describe(file, `option "${option.letter}" ${problem}`),
    ),
  );
}

/**
 * Grades every open item file under every dir `ctx.layout.outboxDirs()` names, plus the two
 * outbox-wide checks: every `Became:` id every `settled.md` carries resolves (a law through
 * `laws`, a playbook section through the form parser), and no open item sits inside a shipped
 * PRD's outbox. Builds `laws` once (`lawsFor(ctx)`, Task 4) and threads it through every per-item
 * and per-ledger check.
 */
export function findOutboxViolations({ ctx }: { ctx: Context }): string[] {
  const laws = lawsFor(ctx);
  const violations: string[] = [];
  const shippedDirs = ctx.layout
    .outboxDirs()
    .filter(({ shipped }) => shipped)
    .map(({ dir }) => dir);

  for (const file of outboxItemFiles({ ctx })) {
    if (shippedDirs.some((dir) => file.startsWith(`${dir}/`))) {
      violations.push(describe(file, 'open item in a shipped PRD — settle it or reopen the PRD'));
      continue;
    }
    violations.push(...checkItemText(file, readRepoFile(ctx, file), { ctx, laws }));
  }

  for (const { dir } of ctx.layout.outboxDirs()) {
    const settledFile = `${dir}/${SETTLED_FILE}`;
    if (!existsSync(join(ctx.root, settledFile))) continue;

    for (const entry of parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers)) {
      for (const id of entry.became) {
        const resolved = isPlaybookId(id) ? resolvePlaybookId(id, { ctx }) : laws.resolve(id);
        if (!resolved.ok) {
          violations.push(
            describe(settledFile, `${entry.id} Became: ${id} — ${resolved.reason}`),
          );
        }
      }
    }
  }

  return violations;
}
