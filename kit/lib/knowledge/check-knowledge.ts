/**
 * **Where truth lives.** Grades the knowledge folder (`ctx.layout.knowledgeRoot`) through the one
 * parser in `registers.mjs`. Every violation names the file the reader should open and the id (or
 * file name) at fault:
 *
 * - **the layout** — `product/` and every `domains/<domain>/` carry the three layer files (a
 *   fourth, `contracts.md`, is optional, PRD 1796), every
 *   domain a `README.md` whose `Glossary term:` is a word the glossary holds (when a glossary is
 *   configured — `ctx.config.paths.glossary`; when there is none, the line must still be present
 *   but is not looked up); a cross-domain file is named `<a>--<b>.md`, two domains that exist, `a`
 *   before `b` alphabetically;
 * - **the id** — never reused; its prefix is its layer's (`P-` principle, `BR-` rule, `N-`
 *   invariant, `DC-` contract, `X-` cross-domain) and names its domain's code, unless a `Kept id:` line says it
 *   predates the layout; `N1`…`N8` live only in `product/invariants.md`;
 * - **the lines** — every entry a statement and a `Source:`; a principle `Why:` and `Decided:` and
 *   never `Enforced by:` (a principle is judged, not proven); a rule exactly one `Serves:` naming
 *   a principle that exists, an `Enforced by:` and a `Stated:` date; an invariant the same without
 *   the `Serves:`; a cross-domain entry a `Kind:`, and a `Serves:` that cites a product principle
 *   or one of its own pair's, never a third domain's;
 * - **contracts** (PRD 1796) — a statement, a `Source:` and a `Stated:` as a rule; a `Points to:`
 *   line whose every path is a file in the tree, never a directory or a glob (an imported copy's
 *   paths are not looked up); and no `Enforced by:`, `Locked:`, `Proposed law:` or `Governs:`, since a
 *   contract is never a law: the file it points to enforces it;
 * - **proof** (PRD 1342) — `Enforced by: pending #<n>` names a law issue, never a path, so none is
 *   looked up; with `laws.requireProof: true`, a rule or an invariant may no longer say `unenforced`:
 *   it names its test, or its law issue. A proposed entry is no law yet, and an imported copy's own
 *   config is its target's, so neither is asked;
 * - **laws** (PRD 1726) — a `Locked:` entry is a rule or an invariant, never a principle, names its
 *   test, and carries no `Proposed:` line (a `Governs:` line is optional, PRD 2346: a law with none is
 *   reached through its domain or its `Layers:`, or is global); the folder holds no more locks than
 *   `laws.max`, and none while `laws.owners` is empty (an imported copy is asked neither); every
 *   `Governs:` pattern is a regular expression, as a flow area's `paths` are; and `product/thesis.md`
 *   lists every locked law in its laws section, and nothing else (`thesis.ts`); and the CODEOWNERS
 *   block `omni kb owners` writes is what it would write now (`codeowners-laws.ts`), present once a
 *   law is locked;
 * - **layers and domains** (PRD 2346) — every word of an entry's `Layers:` line, and of an ADR's
 *   `**Layers:**`, is one of the ten canonical layers (an old word names its replacement); an ADR's
 *   `**Domain:**` names a domain folder that exists;
 * - **honesty** — a path-shaped `Enforced by:` or `Source:` that does not exist is refused: a wrong
 *   claim is worse than an honest `unenforced`; every id cited inside an entry file resolves;
 * - **the tree** (PRD 2416) — product knowledge reads top-down, so an entry of a lower level (the
 *   repository, its plan repository's copy) under the id of a higher level's entry (the plan
 *   repository's, the Omni settings') says what that entry says: another statement or another kind
 *   is a contradiction, naming both entries and their levels (`knowledge-tree/product.ts`). A
 *   repository with no level above it grades as before.
 *
 * In an imported copy's context (`ctx.copyOf`, PRD 522, `copies.mjs`) every path names a file of
 * the target, so none is looked up: the honesty checks on paths and the owning libraries are skipped.
 *
 * A principle no entry serves is a **wish**: reported, never a violation — a signal that nothing
 * concrete makes it true yet.
 *
 * A **proposed** entry (a `Proposed: <who> <YYYY-MM-DD>` line, PRD #68) is one no person has
 * confirmed: a principle may go without `Decided:`, and every other line is graded as for a law. Each
 * is reported once, never a violation; a malformed `Proposed:` line is one.
 */
// Ported from nimbus-brain@c4a210122:scripts/check-registers.mjs — changes in kit/porting/knowledge--check-knowledge.md.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readRepoFile } from '../check-report.ts';
import { defined } from '../narrow.ts';
import {
  REQUIRED_LAYER_FILES,
  domainsDir,
  idParts,
  idsCitedIn,
  LEGAL_ID_SHAPE,
  meansPending,
  productDir,
  readKnowledge,
  servedBy,
  type EntryKind,
  type Knowledge,
  type KnowledgeCtx,
  type KnowledgeEntry,
} from './registers.ts';
import { isLayer, LAYER_ALIASES, layerList } from '../layers/layers.ts';
import { readDecisions } from '../playbook/decisions.ts';
import { invalidGoverns } from './disclose.ts';
import { readThesis, thesisPath, thesisProblems } from './thesis.ts';
import { ownersBlockProblems } from '../codeowners-laws.ts';
import { findContradictions, productEntries, statementOf } from '../knowledge-tree/product.ts';
import type { LawOwner } from '../config.ts';

/**
 * What grading needs of the context: the checkout, where the knowledge folder sits, the glossary's
 * path, the playbook's (its briefing is in the CODEOWNERS block, PRD 1793), and — in an imported copy's context — the target it copies.
 */
export type CheckCtx = KnowledgeCtx & {
  layout: { adrDir?: string };
  config: {
    paths: { glossary: string | null; playbook: string };
    laws?: { requireProof: boolean; max?: number; owners?: readonly LawOwner[] };
  };
  copyOf?: string;
};

/** `laws.max`'s default (PRD 1726), for a context whose config carries none. */
const DEFAULT_LAWS_MAX = 20;

/** A violation: the file, the id and what is wrong — or a problem the parser already wrote. */
export type Violation =
  | { file: string; id: string; detail: string; text?: undefined }
  | { text: string; file?: undefined; id?: undefined; detail?: undefined };

/** One violation, always naming the file the reader should open and the id at fault. */
function violation(file: string, id: string, detail: string): Violation {
  return { file, id, detail };
}

function formatViolation({ file, id, detail, text }: Violation): string {
  return text ?? `${file}: ${id} — ${detail}`;
}

const STATED_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A value naming a repo file: no space, at least one `/`, optionally a `#anchor`. */
const PATH_LIKE = /^[\w.@-]+(?:\/[\w.@-]+)+(?:#\S*)?$/;

/** A reference that leads somewhere without being a path: a PRD, an issue or a pull request number. */
const NUMBER_REFERENCE = /(^|\s)(PRD |issue |PR )?#\d+\b/i;

/** The comma-separated parts of a line's value, backticks stripped. */
function partsOf(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.replace(/`/g, '').trim())
    .filter(Boolean);
}

/** The id prefix each layer's entries carry. */
const PREFIX_OF_KIND: Record<EntryKind, string> = { principle: 'P', rule: 'BR', invariant: 'N', contract: 'DC' };

/** Every library a domain README lists under "## Owning libraries" exists under `ctx.root`. */
export function findOwningLibraryViolations(ctx: CheckCtx, knowledge: Knowledge): Violation[] {
  const violations: Violation[] = [];
  // An imported copy's libraries are its target's, never this disk's (PRD 522).
  if (ctx.copyOf) return violations;
  for (const domain of knowledge.domains) {
    const readme = `${domainsDir(ctx)}/${domain.name}/README.md`;
    if (!existsSync(join(ctx.root, readme))) continue;
    const section = readFileSync(join(ctx.root, readme), 'utf8').split(/^## Owning libraries\s*$/m)[1];
    if (!section) continue;
    const listed = section.split(/^## /m)[0] ?? '';
    for (const match of listed.matchAll(/`((?:libs|apps)\/[^`\s]+)`/g)) {
      const path = (match[1] ?? '').replace(/\/$/, '');
      if (!existsSync(join(ctx.root, path))) {
        violations.push(
          violation(readme, domain.name, `names owning library ${path}, which does not exist.`),
        );
      }
    }
  }
  return violations;
}

/** Product and every domain folder carry their files; a domain README names a glossary word. */
export function findLayoutViolations(
  ctx: CheckCtx,
  knowledge: Knowledge,
  { glossaryText = '' }: { glossaryText?: string } = {},
): Violation[] {
  const violations: Violation[] = [];
  for (const name of REQUIRED_LAYER_FILES) {
    if (!knowledge.productFiles.includes(name)) {
      violations.push(violation(`${productDir(ctx)}/${name}`, 'product', 'is missing.'));
    }
  }
  for (const domain of knowledge.domains) {
    const dir = `${domainsDir(ctx)}/${domain.name}`;
    for (const name of ['README.md', ...REQUIRED_LAYER_FILES]) {
      if (!domain.files.includes(name)) {
        violations.push(violation(`${dir}/${name}`, domain.name, 'is missing.'));
      }
    }
    if (!domain.files.includes('README.md')) continue;
    if (!domain.glossaryTerm) {
      violations.push(
        violation(`${dir}/README.md`, domain.name, 'is missing a "Glossary term:" line.'),
      );
    } else if (
      ctx.config.paths.glossary !== null &&
      !glossaryHolds(glossaryText, domain.glossaryTerm)
    ) {
      violations.push(
        violation(
          `${dir}/README.md`,
          domain.name,
          `glossary term "${domain.glossaryTerm}" is not a word ${ctx.config.paths.glossary} holds.`,
        ),
      );
    }
  }
  return violations;
}

function glossaryHolds(glossaryText: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w])${escaped}([^\\w]|$)`, 'i').test(glossaryText);
}

/** A cross-domain file is `<a>--<b>.md`: two domains that exist, in alphabetical order. */
export function findCrossDomainFileViolations(knowledge: Pick<Knowledge, 'domains' | 'crossDomainFiles'>): Violation[] {
  const known = new Set(knowledge.domains.map((domain) => domain.name));
  const violations: Violation[] = [];
  for (const { file, name, pair } of knowledge.crossDomainFiles) {
    if (!pair) {
      violations.push(violation(file, name, 'is not named "<a>--<b>", two domains.'));
      continue;
    }
    const [a = '', b = ''] = pair;
    for (const half of pair) {
      if (!known.has(half)) {
        violations.push(violation(file, name, `names "${half}", which is not a domain folder.`));
      }
    }
    if (!(a < b)) {
      violations.push(
        violation(
          file,
          name,
          `is out of alphabetical order — a pair is written "${[a, b].sort().join('--')}".`,
        ),
      );
    }
  }
  return violations;
}

/** An id is never reused: the SECOND (and any later) claim of an id already seen is refused. */
export function findReusedIds(entries: readonly Pick<KnowledgeEntry, 'id' | 'file'>[]): Violation[] {
  const firstSeenIn = new Map<string, string>();
  const violations: Violation[] = [];
  for (const { id, file } of entries) {
    const seenIn = firstSeenIn.get(id);
    if (seenIn) {
      violations.push(violation(file, id, `already used in ${seenIn} — an id is never reused.`));
    } else {
      firstSeenIn.set(id, file);
    }
  }
  return violations;
}

/** The id's own shape: its prefix matches its layer and names its domain, or it is a kept id. */
function idShapeViolations(entry: KnowledgeEntry): Violation[] {
  const parts = defined(idParts(entry.id), `the parts of the id ${entry.id}`); // an entry's id is read off an id-shaped heading, so it always splits
  const where =
    entry.scope === 'cross-domain' ? `the pair ${entry.domain}` : `the ${entry.domain} folder`;

  if (entry.scope === 'cross-domain') {
    if (parts.type !== 'X') {
      return [
        violation(entry.file, entry.id, 'is not an X- id — a cross-domain entry is X-<A>-<B>-<n>.'),
      ];
    }
    if (entry.keptId) return [];
    const matches =
      parts.codes.length === entry.codes.length &&
      parts.codes.every((code, index) => code === entry.codes[index]);
    return matches
      ? []
      : [
          violation(
            entry.file,
            entry.id,
            `names ${parts.codes.join('-')}, but it sits in ${where} (X-${entry.codes.join('-')}-<n>), and carries no "Kept id:" line.`,
          ),
        ];
  }

  if (parts.type === 'CORE') {
    if (entry.scope === 'product' && entry.kind === 'invariant') return [];
    return [
      violation(
        entry.file,
        entry.id,
        'is a Core Invariant id — N1…N8 live only in product/invariants.md.',
      ),
    ];
  }

  const expected = entry.kind === null ? undefined : PREFIX_OF_KIND[entry.kind];
  if (parts.type !== expected) {
    return [
      violation(
        entry.file,
        entry.id,
        `is a ${parts.type}- id in a file of ${entry.kind}s, which carry ${expected}- ids.`,
      ),
    ];
  }
  if (entry.keptId || parts.codes[0] === entry.codes[0]) return [];
  return [
    violation(
      entry.file,
      entry.id,
      `names ${parts.codes[0]}, but it sits in ${where} (code ${entry.codes[0]}) and carries no "Kept id:" line.`,
    ),
  ];
}

/** The anchors GitHub gives a markdown file's headings: lowercased, punctuation dropped, each space a hyphen, a repeat suffixed. */
export function headingAnchors(text: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const match = !fenced && line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!match) continue;
    const base = (match[1] ?? '')
      .replace(/`/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

/** Paths a line names must exist under `ctx.root`: a wrong claim is worse than an honest `unenforced`. */
function missingPathViolations(
  ctx: CheckCtx,
  entry: KnowledgeEntry,
  label: string,
  value: string,
  { onlyPathLike }: { onlyPathLike: boolean },
): Violation[] {
  const violations: Violation[] = [];
  // An imported copy's paths name files of its target, never of this disk (PRD 522).
  if (ctx.copyOf) return violations;
  for (const part of partsOf(value)) {
    if (onlyPathLike && !PATH_LIKE.test(part)) continue;
    const [path = '', anchor] = part.split('#');
    if (anchor && existsSync(join(ctx.root, path)) && path.endsWith('.md')) {
      if (!headingAnchors(readFileSync(join(ctx.root, path), 'utf8')).has(anchor.toLowerCase())) {
        violations.push(
          violation(
            entry.file,
            entry.id,
            `links "${label}: ${path}#${anchor}", but ${path} has no heading with that anchor.`,
          ),
        );
      }
      continue;
    }
    if (!existsSync(join(ctx.root, path))) {
      violations.push(
        violation(
          entry.file,
          entry.id,
          `claims "${label}: ${path}" but that file does not exist — a wrong claim is worse than "unenforced".`,
        ),
      );
    }
  }
  return violations;
}

/** A `Serves:` line: one id, a principle that exists, and — cross-domain — of the right domain. */
function servesViolations(entry: KnowledgeEntry & { serves: string }, principles: readonly KnowledgeEntry[]): Violation[] {
  if ((entry.fieldCounts.serves ?? 0) > 1) {
    return [
      violation(
        entry.file,
        entry.id,
        'has more than one "Serves:" line — a rule serves exactly one principle.',
      ),
    ];
  }
  const target = entry.serves.replace(/`/g, '').trim();
  // A Legal entry lives on the Omni page: its shape is graded here, its existence by the product read.
  if (LEGAL_ID_SHAPE.test(target)) return [];
  if (!/^P-[A-Z0-9]+-\d+$/.test(target)) {
    return [
      violation(
        entry.file,
        entry.id,
        `serves "${entry.serves}", which is not one principle id or a Legal entry id (L-<CODE>-<n>).`,
      ),
    ];
  }
  const principle = principles.find((candidate) => candidate.id === target);
  if (!principle) {
    return [violation(entry.file, entry.id, `serves ${target}, which no principle claims.`)];
  }
  if (
    entry.scope === 'domain' &&
    principle.scope !== 'product' &&
    principle.domain !== entry.domain
  ) {
    return [
      violation(
        entry.file,
        entry.id,
        `serves ${target}, a principle of "${principle.domain}" — an entry of one domain serves a product principle or its own; where two domains meet, it is a cross-domain entry.`,
      ),
    ];
  }
  if (entry.scope === 'cross-domain') {
    const own =
      principle.scope === 'product' || entry.domain.split('--').includes(principle.domain);
    if (!own) {
      return [
        violation(
          entry.file,
          entry.id,
          `serves ${target}, a principle of "${principle.domain}" — a cross-domain entry serves a product principle or one of its own pair's.`,
        ),
      ];
    }
  }
  return [];
}

/** An entry's `Source:` line: present, every path it names real, and leading somewhere. */
function sourceViolations(ctx: CheckCtx, entry: KnowledgeEntry): Violation[] {
  if (!entry.source) return [violation(entry.file, entry.id, 'is missing a "Source:" line.')];
  const violations = missingPathViolations(ctx, entry, 'Source', entry.source, { onlyPathLike: true });
  const leads = partsOf(entry.source).some(
    (part) => PATH_LIKE.test(part) || NUMBER_REFERENCE.test(part),
  );
  if (!leads) {
    violations.push(
      violation(
        entry.file,
        entry.id,
        `has "Source: ${entry.source}", which leads nowhere — name a file that exists, or a PRD or issue number.`,
      ),
    );
  }
  return violations;
}

/** A principle's own lines: a `Why:`, a `Decided:` unless proposed, and never an `Enforced by:`. */
function principleViolations(entry: KnowledgeEntry): Violation[] {
  const violations: Violation[] = [];
  if (entry.enforcedBy !== null) {
    violations.push(
      violation(
        entry.file,
        entry.id,
        'carries an "Enforced by:" line — a principle is judged, not proven; a rule serving it carries the proof.',
      ),
    );
  }
  if (!entry.why) violations.push(violation(entry.file, entry.id, 'is missing a "Why:" line.'));
  if (!entry.decided && entry.proposed === null) {
    violations.push(violation(entry.file, entry.id, 'is missing a "Decided:" line.'));
  }
  return violations;
}

/** Every entry's lines, by kind. */
export function findEntryViolations(ctx: CheckCtx, entries: readonly KnowledgeEntry[]): Violation[] {
  const requireProof = ctx.config.laws?.requireProof === true && !ctx.copyOf;
  const principles = entries.filter((entry) => entry.kind === 'principle');
  const violations: Violation[] = [];

  for (const entry of entries) {
    violations.push(...idShapeViolations(entry));
    violations.push(...entry.problems.map((problem) => ({ text: problem })));
    violations.push(...lockViolations(entry));

    if (entry.scope === 'cross-domain' && !entry.kind) {
      violations.push(
        violation(entry.file, entry.id, 'is missing a "Kind: rule" or "Kind: invariant" line.'),
      );
    }
    if (!entry.statement) violations.push(violation(entry.file, entry.id, 'has no statement.'));
    violations.push(...sourceViolations(ctx, entry));

    if (entry.kind === 'principle') {
      violations.push(...principleViolations(entry));
      continue;
    }

    if (entry.kind === 'rule' && entry.serves === null) {
      violations.push(
        violation(
          entry.file,
          entry.id,
          'is missing a "Serves:" line — every rule serves one principle.',
        ),
      );
    }
    if (entry.serves !== null) violations.push(...servesViolations({ ...entry, serves: entry.serves }, principles));

    if (!entry.stated || !STATED_DATE.test(entry.stated)) {
      violations.push(violation(entry.file, entry.id, 'is missing a "Stated: YYYY-MM-DD" line.'));
    }
    // A contract is never a law (PRD 1796): its `Points to:` is its proof, never an `Enforced by:`.
    violations.push(...(entry.kind === 'contract' ? contractViolations(ctx, entry) : proofViolations(ctx, entry, requireProof)));
  }
  return violations;
}

/** A glob's characters: a `Points to:` path names each file, never a pattern. */
const GLOB = /[*?[\]{}]/;

/**
 * A contract's own lines (PRD 1796): a `Points to:` naming files that exist — never a directory or a
 * glob; an imported copy's paths name its target's files, so none is looked up — and none of the
 * lines that make a law: the file a contract points to is its enforcement. A `Locked:` line is
 * refused by {@link lockViolations}.
 */
function contractViolations(ctx: CheckCtx, entry: KnowledgeEntry): Violation[] {
  const violations: Violation[] = [];
  if (entry.pointsTo === null || entry.pointsTo.length === 0) {
    violations.push(violation(entry.file, entry.id, 'is missing a "Points to:" line — a contract names the schema or type file(s) that enforce it.'));
  }
  for (const path of entry.pointsTo ?? []) {
    if (GLOB.test(path)) {
      violations.push(violation(entry.file, entry.id, `points to "${path}", which is a glob — name each file that enforces it.`));
      continue;
    }
    // An imported copy's paths name files of its target, never of this disk (PRD 522).
    if (ctx.copyOf) continue;
    const absolute = join(ctx.root, path);
    if (!existsSync(absolute)) {
      violations.push(violation(entry.file, entry.id, `points to "${path}", which does not exist — fix its "Points to:" line.`));
    } else if (!statSync(absolute).isFile()) {
      violations.push(violation(entry.file, entry.id, `points to "${path}", which is a directory — name the file(s) that enforce it.`));
    }
  }
  if (entry.enforcedBy !== null) {
    violations.push(violation(entry.file, entry.id, 'carries an "Enforced by:" line — a contract is never a law: the file its "Points to:" names enforces it.'));
  }
  if (entry.proposedLaw !== null) {
    violations.push(violation(entry.file, entry.id, 'carries a "Proposed law:" line — a contract is never a law.'));
  }
  if (entry.governs !== null) {
    violations.push(violation(entry.file, entry.id, 'carries a "Governs:" line — its "Points to:" already names the files it is about, and omni kb laws lists rules and laws only.'));
  }
  return violations;
}

/**
 * A rule's or an invariant's `Enforced by:` line: present; a path that exists; `pending #<n>`, which
 * names a law issue and no path (its shape is the parser's to refuse); or `unenforced`, refused for
 * a law once `requireProof` is on (PRD 1342).
 */
function proofViolations(ctx: CheckCtx, entry: KnowledgeEntry, requireProof: boolean): Violation[] {
  if (entry.enforcedBy === null) return [violation(entry.file, entry.id, 'is missing an "Enforced by:" line.')];
  if (entry.enforcedBy === 'unenforced') {
    if (!requireProof || entry.proposed !== null) return [];
    return [
      violation(
        entry.file,
        entry.id,
        `is "Enforced by: unenforced", and laws.requireProof is true — name the test's path, or "pending #<n>", its law issue.`,
      ),
    ];
  }
  if (meansPending(entry.enforcedBy)) return [];
  return missingPathViolations(ctx, entry, 'Enforced by', entry.enforcedBy, { onlyPathLike: false });
}

/**
 * A locked entry's own lines (PRD 1726): a principle is never locked; a law names its test on
 * `Enforced by:` (a path — never `unenforced` or `pending #<n>`); and a person locked it, so no `Proposed:` line stays beside the lock.
 */
function lockViolations(entry: KnowledgeEntry): Violation[] {
  if (entry.locked === null) return [];
  if (entry.kind === 'principle') {
    return [violation(entry.file, entry.id, 'is locked, but a principle is never a law — lock a rule or an invariant that serves it.')];
  }
  if (entry.kind === 'contract') {
    return [violation(entry.file, entry.id, 'is locked, but a contract is never a law — lock a rule or an invariant instead.')];
  }
  const violations: Violation[] = [];
  if (!entry.enforced) {
    violations.push(violation(entry.file, entry.id, 'is locked, but "Enforced by:" names no test — a law is proven: name its test\'s path.'));
  }
  if (entry.proposed !== null) {
    violations.push(violation(entry.file, entry.id, 'is locked and proposed at once — a person locked it: remove its "Proposed:" line.'));
  }
  return violations;
}

/**
 * The folder's locks against its config (PRD 1726): no more than `laws.max`, and none while
 * `laws.owners` names nobody who may lock one. A malformed lock and a locked principle count: each
 * is a lock someone meant. An imported copy's config is its target's, so neither is asked of it.
 */
function findLockCountViolations(ctx: CheckCtx, entries: readonly KnowledgeEntry[]): Violation[] {
  if (ctx.copyOf) return [];
  const locks = entries.filter((entry) => entry.locked !== null).length;
  if (locks === 0) return [];
  const max = ctx.config.laws?.max ?? DEFAULT_LAWS_MAX;
  const owners = ctx.config.laws?.owners ?? [];
  const counted = `${locks} locked ${locks === 1 ? 'entry' : 'entries'}`;
  const where = ctx.layout.knowledgeRoot;
  const violations: Violation[] = [];
  if (locks > max) {
    violations.push({
      text: `${where}: ${counted}, more than laws.max (${max}) — a law is one of the few truths that cost the most when broken: strike one, or raise laws.max.`,
    });
  }
  if (owners.length === 0) {
    violations.push({
      text: `${where}: ${counted}, and laws.owners is empty — name who may lock a law and approve a change to one in laws.owners before locking.`,
    });
  }
  return violations;
}

/**
 * Every `Governs:` pattern the flow areas' matcher could not read (PRD 1726): each is a regular
 * expression over repository paths, as an area's `paths` are, so a glob like `**` is refused.
 */
function findGovernsViolations(entries: readonly KnowledgeEntry[]): Violation[] {
  return entries.flatMap((entry) =>
    invalidGoverns(entry.governs ?? []).map((source) =>
      violation(entry.file, entry.id, `"Governs:" lists "${source}", which is not a regular expression over paths — write it as a flow area's paths are written, such as ^kit/lib/outbox/.`),
    ),
  );
}

/** Why `word` is no layer: the canonical list, and the layer an old word is read as. */
function notALayer(word: string): string {
  const alias = Object.hasOwn(LAYER_ALIASES, word) ? ` ("${word}" is an old word for "${LAYER_ALIASES[word]}")` : '';
  return `"${word}", which is not a layer${alias} — the layers are ${layerList()}.`;
}

/** Every `Layers:` word of an entry that is not one of the canonical layers (PRD 2346). */
function findLayerViolations(entries: readonly KnowledgeEntry[]): Violation[] {
  return entries.flatMap((entry) =>
    (entry.layers ?? []).filter((word) => !isLayer(word)).map((word) => violation(entry.file, entry.id, `"Layers:" lists ${notALayer(word)}`)),
  );
}

/**
 * Every ADR tag that names nothing (PRD 2346): a `**Layers:**` word outside the canonical list, and a
 * `**Domain:**` with no folder under the knowledge folder. Only when the context says where the ADRs
 * live; an imported copy's ADRs are its target's, so none is read.
 */
function findDecisionTagViolations(ctx: CheckCtx, knowledge: Knowledge): Violation[] {
  const adrDir = ctx.layout.adrDir;
  if (ctx.copyOf || adrDir === undefined) return [];
  const folders = new Set(['product', ...knowledge.domains.map((domain) => domain.name)]);
  return readDecisions({ ctx: { root: ctx.root, layout: { adrDir } } }).records.flatMap((record) => [
    ...(record.layers ?? []).filter((word) => !isLayer(word)).map((word) => violation(record.file, `ADR-${record.number}`, `"**Layers:**" lists ${notALayer(word)}`)),
    ...(record.domain != null && !folders.has(record.domain)
      ? [violation(record.file, `ADR-${record.number}`, `"**Domain:**" names "${record.domain}", which is no domain folder — the folders are ${[...folders].join(', ')}.`)]
      : []),
  ]);
}

/**
 * The thesis against the locks (PRD 1726): its laws section lists every locked law and nothing else,
 * each line with its `If broken:`; once a law is locked, the thesis must exist. An imported copy is
 * not asked: it is a draft of its target's folder.
 */
function findThesisViolations(ctx: CheckCtx, entries: readonly KnowledgeEntry[]): Violation[] {
  if (ctx.copyOf) return [];
  return thesisProblems(readThesis(ctx), entries, thesisPath(ctx)).map((text) => ({ text }));
}

/**
 * The CODEOWNERS block against the locks (PRD 1726): what `omni kb owners` would write now, so a
 * change to a law asks its owner. An imported copy is not asked: its CODEOWNERS is its target's.
 */
function findOwnersBlockViolations(ctx: CheckCtx, knowledge: Knowledge): Violation[] {
  if (ctx.copyOf) return [];
  return ownersBlockProblems(ctx, knowledge).map((text) => ({ text }));
}

/** `a rule`, `an invariant`: an entry's kind with its article, for one line of the check. */
function aKind(kind: EntryKind | null): string {
  if (kind === null) return 'an entry of no kind';
  return `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}`;
}

/**
 * Every product entry a lower level of the knowledge tree holds that contradicts a higher level's
 * (PRD 2416): the tree reads product knowledge top-down, so a level may add to the levels above it,
 * never change them (`knowledge-tree/product.ts`). One line per pair, naming both entries, their
 * levels and what differs. A repository with no level above it has nothing to contradict; an
 * imported copy is its target's, graded on its own.
 */
function findLevelContradictions(ctx: CheckCtx): Violation[] {
  if (ctx.copyOf) return [];
  return findContradictions(productEntries({ ctx })).map(({ lower, higher, on }) => {
    const differs =
      on === 'kind'
        ? `${aKind(lower.entry.kind)} against ${aKind(higher.entry.kind)}`
        : `"${statementOf(lower.entry)}" against "${statementOf(higher.entry)}"`;
    return {
      text:
        `${lower.entry.file}: ${lower.entry.id} [${lower.level}] contradicts ${higher.entry.id} [${higher.level}] in ${higher.entry.file} — ` +
        `${differs}: a level may add to the product knowledge above it, never change it — say it as the level above does, or give the new entry an id of its own.`,
    };
  });
}

/** Every id-shaped token inside `file`'s own text resolves — a stray `BR-QUOTE-9` is drift. */
export function findUnresolvedCitations(file: string, text: string, resolve: (id: string) => unknown): Violation[] {
  return idsCitedIn(text)
    .filter((id) => !LEGAL_ID_SHAPE.test(id) && !resolve(id))
    .map((id) => violation(file, id, `is cited in ${file} but does not resolve to any entry.`));
}

/** Every principle no entry serves — a wish, reported and never failed. */
export function findWishes(entries: readonly KnowledgeEntry[]): Violation[] {
  return entries
    .filter((entry) => entry.kind === 'principle' && servedBy(entries, entry.id).length === 0)
    .map((entry) =>
      violation(entry.file, entry.id, 'is a wish — no rule or invariant serves it yet.'),
    );
}

/** Every proposed entry — not a law until a person removes its `Proposed:` line; reported, never failed. */
export function findProposals(entries: readonly KnowledgeEntry[]): Violation[] {
  return entries
    .filter((entry) => entry.proposed !== null && entry.proposed.by !== null)
    .map((entry) =>
      violation(
        entry.file,
        entry.id,
        `is proposed by ${entry.proposed?.by} on ${entry.proposed?.on} — not a law until a person removes its "Proposed:" line.`,
      ),
    );
}

/**
 * The whole grade of the knowledge folder at `ctx`: `{ violations, wishes, proposals }`, all
 * formatted text.
 *
 * `files` names the entry files to check for stray id citations (the caller — a test, or the CLI
 * with `readKnowledge({ ctx }).entries` reduced to their `file`s — already knows which files those
 * are). `glossaryText` lets a caller supply the glossary's text directly instead of having it read
 * from `ctx.config.paths.glossary`, which is `null` when the repository configures none.
 */
export function gradeKnowledge({
  ctx,
  files = [],
  glossaryText,
}: {
  ctx: CheckCtx;
  files?: readonly string[];
  glossaryText?: string;
}): { violations: string[]; wishes: string[]; proposals: string[] } {
  const knowledge = readKnowledge({ ctx });
  const resolve = (id: string) => knowledge.entries.find((entry) => entry.id === id);
  const text =
    glossaryText ?? (ctx.config.paths.glossary ? readRepoFile(ctx, ctx.config.paths.glossary) : '');

  const violations = [
    ...findLayoutViolations(ctx, knowledge, { glossaryText: text }),
    ...findOwningLibraryViolations(ctx, knowledge),
    ...findCrossDomainFileViolations(knowledge),
    ...findReusedIds(knowledge.entries),
    ...findEntryViolations(ctx, knowledge.entries),
    ...findLockCountViolations(ctx, knowledge.entries),
    ...findGovernsViolations(knowledge.entries),
    ...findLayerViolations(knowledge.entries),
    ...findDecisionTagViolations(ctx, knowledge),
    ...findThesisViolations(ctx, knowledge.entries),
    ...findOwnersBlockViolations(ctx, knowledge),
    ...findLevelContradictions(ctx),
    ...files.flatMap((file) => findUnresolvedCitations(file, readRepoFile(ctx, file), resolve)),
  ];

  return {
    violations: violations.map(formatViolation),
    wishes: findWishes(knowledge.entries).map(formatViolation),
    proposals: findProposals(knowledge.entries).map(formatViolation),
  };
}

/** The Legal ids the rules and invariants serve, with the entry that serves each (PRD 1795). */
export function servedLegalIds(entries: readonly KnowledgeEntry[]): { id: string; entry: KnowledgeEntry }[] {
  return entries.flatMap((entry) => {
    const id = entry.serves?.replace(/`/g, '').trim() ?? '';
    return LEGAL_ID_SHAPE.test(id) ? [{ id, entry }] : [];
  });
}
