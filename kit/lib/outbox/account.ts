/**
 * **An account is a typed thing** (PRD #1044, slice s2).
 *
 * The ONE parser for a slice's account file — the written record a slice owes for every risky
 * change `decision-coverage.mjs`'s `riskyChanges` flags on its diff, kept under `accounts/` inside
 * the PRD's own outbox directory (`` `${ctx.layout.outboxDir(prd)}/accounts` ``). Zod-first per
 * invariant N1: markdown text in, a typed account out, named errors on the way — the same `{ ok,
 * account | errors }` discipline `outbox.mjs`'s own `parseOutboxItem` uses for an item.
 *
 * Front matter is the plain `key: value` shape both existing registers use (`prd`, `slice`,
 * `graded`), never full YAML. Exactly one section follows, `## Risky changes`, holding one entry
 * per accounted change: a backticked path, the rule id that fired, and an account line that is one
 * of exactly two forms — `item <id>` or `spec <where>` — and no third.
 *
 * This module never globs item markdown itself: an `item <id>` account is checked against
 * `outboxItemFiles` (`outbox.mjs`), the one place that reads an outbox directory. It also never
 * imports `decision-coverage.mjs` — the account format and the five rules are separate readings of
 * separate inputs, so `compare` only ever sees the `riskyChanges` output a caller already computed,
 * never the rules themselves.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-account.mjs — changes in kit/porting/outbox--account.md.
import { existsSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { readRepoFile } from '../check-report.ts';
import { withFile } from '../front-matter.ts';
import { AccountFrontMatterSchema } from '../schema/front-matter.ts';
import { SETTLED_FILE, outboxItemFiles, parseHeadingSections, readFrontMatterBlock } from './outbox.ts';
import type { OutboxContext } from './outbox.ts';
import { parseSettledEntries } from './settle.ts';

/** What an entry's account line says: `item <id>` or `spec <where>`, and no third form. */
export type AccountLine = { kind: 'item'; id: string } | { kind: 'spec'; where: string };

/** One accounted risky change: its path, the rule that fired, and the account written for it. */
export type AccountEntry = { path: string; rule: string; account: AccountLine };

/** A slice's account, parsed. */
export type Account = { prd: number; slice: string; graded: string; entries: AccountEntry[]; file: string | null };

/** The result of {@link parseAccount} (and of each file {@link readAccounts} reads). */
export type ParsedAccount = { ok: true; account: Account } | { ok: false; errors: string[] };

/** One change of a range, exactly `git diff --name-status` shape. */
export type Change = { path: string; status: string };

/** A change a decision-coverage rule fired on (`riskyChanges`, `decision-coverage.ts`). */
export type RiskyChange = Change & { rule: string };

/** An account entry carried with the slice and file it came from, as {@link compare} reports it. */
export type NamedEntry = AccountEntry & { slice: string; file: string | null };

/** The subdirectory an account file lives under, inside its PRD's own outbox directory. */
export const ACCOUNTS_DIR = 'accounts';

/** The one heading an account body carries. */
const RISKY_CHANGES_HEADING = 'Risky changes';

const ENTRY_PATH_LINE = /^-\s+`([^`]+)`$/;
const ENTRY_RULE_LINE = /^([a-z][a-z0-9-]*)$/;
const ENTRY_ACCOUNT_LINE = /^(item|spec)\s+(.+)$/;

/** The `index`th capture of `match`; `''` when that group took no part in the match. */
function captured(match: RegExpMatchArray, index: number): string {
  return match[index] ?? '';
}

/** `lines` in consecutive groups of three, in order; a trailing group of fewer is left out. */
function groupsOfThree(lines: readonly string[]): [string, string, string][] {
  const groups: [string, string, string][] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    groups.push([lines[i] ?? '', lines[i + 1] ?? '', lines[i + 2] ?? '']);
  }
  return groups;
}

/**
 * Parses the `## Risky changes` section's content into `{ path, rule, account }` entries. Entries
 * come in fixed groups of three non-blank lines — a backticked path, a rule id, and an account —
 * blank lines between entries are allowed and ignored, since they are only for readability.
 */
function parseEntries(content: string): { errors: string[]; entries: AccountEntry[] } {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return { errors: [], entries: [] };

  if (lines.length % 3 !== 0) {
    return {
      errors: [
        'risky change entries must come in groups of three lines: a backticked path, a rule id, and an account',
      ],
      entries: [],
    };
  }

  const errors: string[] = [];
  const entries: AccountEntry[] = [];

  // The length is a multiple of three here, so every line falls in a group.
  for (const [pathLine, ruleLine, accountLine] of groupsOfThree(lines)) {
    const pathMatch = pathLine.match(ENTRY_PATH_LINE);
    if (!pathMatch) {
      errors.push(`risky change entry must start with a backticked path: "${pathLine}"`);
      continue;
    }

    const ruleMatch = ruleLine.match(ENTRY_RULE_LINE);
    if (!ruleMatch) {
      errors.push(`risky change entry's second line must be a rule id: "${ruleLine}"`);
      continue;
    }

    const accountMatch = accountLine.match(ENTRY_ACCOUNT_LINE);
    if (!accountMatch) {
      errors.push(
        `account must be "item <id>" or "spec <where>", and no third form: "${accountLine}"`,
      );
      continue;
    }

    const kind = captured(accountMatch, 1);
    const value = captured(accountMatch, 2).trim();
    entries.push({
      path: captured(pathMatch, 1),
      rule: captured(ruleMatch, 1),
      account: kind === 'item' ? { kind: 'item', id: value } : { kind: 'spec', where: value },
    });
  }

  return { errors, entries };
}

/**
 * Validates that `body` carries exactly one heading, `## Risky changes`, and parses its entries.
 * Returns `{ errors, entries }`.
 */
function validateBody(body: string): { errors: string[]; entries: AccountEntry[] } {
  const found = parseHeadingSections(body);

  if (found.length === 0) {
    return { errors: [`missing section: "## ${RISKY_CHANGES_HEADING}"`], entries: [] };
  }

  const errors: string[] = [];
  const unexpected = found.filter((section) => section.heading !== RISKY_CHANGES_HEADING);
  if (unexpected.length > 0) {
    errors.push(
      `unexpected heading(s): ${unexpected.map((section) => `"## ${section.heading}"`).join(', ')}`,
    );
  }

  const riskyChangesSection = found.find((section) => section.heading === RISKY_CHANGES_HEADING);
  if (!riskyChangesSection) {
    errors.push(`missing section: "## ${RISKY_CHANGES_HEADING}"`);
    return { errors, entries: [] };
  }

  const { errors: entryErrors, entries } = parseEntries(riskyChangesSection.content);
  errors.push(...entryErrors);

  return { errors, entries };
}

/**
 * Parses one account's full markdown text into a typed account, or a list of human-readable
 * errors. Pure — no filesystem access, so a fixture string is enough to exercise every case. Does
 * NOT check that an `item <id>` account resolves to a real outbox item file; that needs disk, and
 * lives in {@link readAccounts}.
 *
 * @param {string} text raw file content
 * @param {{ file?: string | null }} [options] `file` is only used to prefix error messages
 * @returns {{ ok: true, account: object } | { ok: false, errors: string[] }}
 */
export function parseAccount(text: string, { file = null }: { file?: string | null } = {}): ParsedAccount {
  const read = readFrontMatterBlock(text, file, AccountFrontMatterSchema);
  if (read.body === null) return { ok: false, errors: read.errors };

  const { errors: bodyErrors, entries } = validateBody(read.body);
  const errors = [...read.errors, ...bodyErrors.map((message) => withFile(file, message))];

  // A front matter the schema refused always left at least one error above.
  if (errors.length > 0 || read.data === null) return { ok: false, errors };

  const fm = read.data;
  const account: Account = {
    prd: fm.prd,
    slice: fm.slice,
    graded: fm.graded,
    entries,
    file,
  };
  return { ok: true, account };
}

/**
 * Every slice's account file for one PRD, off disk — sorted, from `` `${ctx.layout.outboxDir(prd)}
 * /accounts` ``. Parses each with {@link parseAccount} and additionally resolves every `item <id>`
 * account against {@link outboxItemFiles} scoped to this PRD, and the ids its `settled.md` records
 * — the one disk check this module owns, kept out of {@link parseAccount} so that function stays
 * pure. An id no outbox file carries turns that file's result into a refusal, named after the id.
 *
 * An absent `accounts/` directory (a PRD with no risky change yet, or no outbox directory at all)
 * reads as `[]`, not an error. Only this PRD's own directory is ever read, so two PRDs — or two
 * slices of the same one — never see each other's files.
 *
 * @param {string | number} prd
 * @param {{ ctx: object }} options
 * @returns {({ ok: true, account: object } | { ok: false, errors: string[] })[]}
 */
export function readAccounts(prd: string | number, { ctx }: { ctx: OutboxContext }): ParsedAccount[] {
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) return [];

  const dir = `${outboxDir}/${ACCOUNTS_DIR}`;
  if (!existsSync(`${ctx.root}/${dir}`)) return [];

  const prdPrefix = `${outboxDir}/`;
  const itemIds = new Set(
    outboxItemFiles({ ctx })
      .filter((path) => path.startsWith(prdPrefix))
      .map((path) => basename(path, '.md')),
  );
  // A settled item is still the decision the account points at: settling moves it into
  // `settled.md`, it does not unmake it.
  const settledFile = `${outboxDir}/${SETTLED_FILE}`;
  if (existsSync(`${ctx.root}/${settledFile}`)) {
    for (const entry of parseSettledEntries(readRepoFile(ctx, settledFile), ctx.markers)) {
      itemIds.add(entry.id);
    }
  }

  const names = readdirSync(`${ctx.root}/${dir}`)
    .filter((name) => name.endsWith('.md'))
    .sort();

  return names.map((name): ParsedAccount => {
    const file = `${dir}/${name}`;
    const text = readRepoFile(ctx, file);
    const parsed = parseAccount(text, { file });
    if (!parsed.ok) return parsed;

    const unresolved = parsed.account.entries.flatMap((entry) =>
      entry.account.kind === 'item' && !itemIds.has(entry.account.id) ? [entry.account.id] : [],
    );
    if (unresolved.length > 0) {
      return {
        ok: false,
        errors: unresolved.map((id) =>
          withFile(
            file,
            `item account names an id no outbox file carries: "${id}"`,
          ),
        ),
      };
    }

    return parsed;
  });
}

/** `path` and `rule` together identify one risky change (a path may fire more than one rule). */
function entryKey(change: { path: string; rule: string }): string {
  return `${change.path}\u0000${change.rule}`;
}

/**
 * Compares a range's risky changes against the accounts written for them — pure, over two lists,
 * no disk access. `risky` is `riskyChanges`'s output (`decision-coverage.mjs`, `{ path, status,
 * rule }[]`); `accounts` is a list of typed accounts shaped like {@link parseAccount}'s `account`
 * — in practice the `ok: true` results {@link readAccounts} returns, with any refusal already
 * handled by the caller.
 *
 * - `accounted` — a risky change some entry names, matched on `path` **and** `rule` together, since
 *   one path firing two rules needs two entries.
 * - `unaccounted` — a risky change no entry names. The only fatal list.
 * - `stale` — an entry naming a `path`/`rule` pair the risky list does not hold. Reported, never
 *   fatal — a rebase shifting the range, or a rule set change, is a planner being wrong about the
 *   ground, not a breach.
 *
 * @param {{ path: string, status: string, rule: string }[]} risky
 * @param {{ slice: string, file: string | null, entries: { path: string, rule: string, account: object }[] }[]} accounts
 * @returns {{ accounted: object[], unaccounted: object[], stale: object[] }}
 */
export function compare<R extends { path: string; rule: string }>(
  risky: readonly R[],
  accounts: readonly Pick<Account, 'slice' | 'file' | 'entries'>[],
): { accounted: R[]; unaccounted: R[]; stale: NamedEntry[] } {
  const entries: NamedEntry[] = accounts.flatMap((account) =>
    account.entries.map((entry) => ({ ...entry, slice: account.slice, file: account.file })),
  );

  const namedKeys = new Set(entries.map(entryKey));
  const riskyKeys = new Set(risky.map(entryKey));

  const accounted = risky.filter((change) => namedKeys.has(entryKey(change)));
  const unaccounted = risky.filter((change) => !namedKeys.has(entryKey(change)));
  const stale = entries.filter((entry) => !riskyKeys.has(entryKey(entry)));

  return { accounted, unaccounted, stale };
}
