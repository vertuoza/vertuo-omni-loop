/**
 * **Where truth lives.** Grades the knowledge folder (`ctx.layout.knowledgeRoot`) through the one
 * parser in `registers.mjs`. Every violation names the file the reader should open and the id (or
 * file name) at fault:
 *
 * - **the layout** — `product/` and every `domains/<domain>/` carry the three layer files, every
 *   domain a `README.md` whose `Glossary term:` is a word the glossary holds (when a glossary is
 *   configured — `ctx.config.paths.glossary`; when there is none, the line must still be present
 *   but is not looked up); a cross-domain file is named `<a>--<b>.md`, two domains that exist, `a`
 *   before `b` alphabetically;
 * - **the id** — never reused; its prefix is its layer's (`P-` principle, `BR-` rule, `N-`
 *   invariant, `X-` cross-domain) and names its domain's code, unless a `Kept id:` line says it
 *   predates the layout; `N1`…`N8` live only in `product/invariants.md`;
 * - **the lines** — every entry a statement and a `Source:`; a principle `Why:` and `Decided:` and
 *   never `Enforced by:` (a principle is judged, not proven); a rule exactly one `Serves:` naming
 *   a principle that exists, an `Enforced by:` and a `Stated:` date; an invariant the same without
 *   the `Serves:`; a cross-domain entry a `Kind:`, and a `Serves:` that cites a product principle
 *   or one of its own pair's, never a third domain's;
 * - **honesty** — a path-shaped `Enforced by:` or `Source:` that does not exist is refused: a wrong
 *   claim is worse than an honest `unenforced`; every id cited inside an entry file resolves.
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
// Ported from vertuo-ai-domain@c4a210122:scripts/check-registers.mjs — changes in kit/porting/knowledge--check-knowledge.md.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRepoFile } from '../check-report.ts';
import {
  LAYER_FILES,
  domainsDir,
  idParts,
  idsCitedIn,
  productDir,
  readKnowledge,
  servedBy,
  type EntryKind,
  type Knowledge,
  type KnowledgeCtx,
  type KnowledgeEntry,
} from './registers.ts';

/**
 * What grading needs of the context: the checkout, where the knowledge folder sits, the glossary's
 * path, and — in an imported copy's context — the target it copies.
 */
export type CheckCtx = KnowledgeCtx & {
  config: { paths: { glossary: string | null } };
  copyOf?: string;
};

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
const PREFIX_OF_KIND: Record<EntryKind, string> = { principle: 'P', rule: 'BR', invariant: 'N' };

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
  for (const name of Object.keys(LAYER_FILES)) {
    if (!knowledge.productFiles.includes(name)) {
      violations.push(violation(`${productDir(ctx)}/${name}`, 'product', 'is missing.'));
    }
  }
  for (const domain of knowledge.domains) {
    const dir = `${domainsDir(ctx)}/${domain.name}`;
    for (const name of ['README.md', ...Object.keys(LAYER_FILES)]) {
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
  const parts = idParts(entry.id)!; // ts-allow: an entry's id is read off an id-shaped heading, so it always splits
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
  if (!/^P-[A-Z0-9]+-\d+$/.test(target)) {
    return [
      violation(entry.file, entry.id, `serves "${entry.serves}", which is not one principle id.`),
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

/** Every entry's lines, by kind. */
export function findEntryViolations(ctx: CheckCtx, entries: readonly KnowledgeEntry[]): Violation[] {
  const principles = entries.filter((entry) => entry.kind === 'principle');
  const violations: Violation[] = [];

  for (const entry of entries) {
    violations.push(...idShapeViolations(entry));
    violations.push(...(entry.problems ?? []).map((problem) => ({ text: problem })));

    if (entry.scope === 'cross-domain' && !entry.kind) {
      violations.push(
        violation(entry.file, entry.id, 'is missing a "Kind: rule" or "Kind: invariant" line.'),
      );
    }
    if (!entry.statement) violations.push(violation(entry.file, entry.id, 'has no statement.'));

    if (!entry.source) {
      violations.push(violation(entry.file, entry.id, 'is missing a "Source:" line.'));
    } else {
      violations.push(
        ...missingPathViolations(ctx, entry, 'Source', entry.source, { onlyPathLike: true }),
      );
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
    }

    if (entry.kind === 'principle') {
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
    if (entry.enforcedBy === null) {
      violations.push(violation(entry.file, entry.id, 'is missing an "Enforced by:" line.'));
    } else if (entry.enforcedBy !== 'unenforced') {
      violations.push(
        ...missingPathViolations(ctx, entry, 'Enforced by', entry.enforcedBy, {
          onlyPathLike: false,
        }),
      );
    }
  }
  return violations;
}

/** Every id-shaped token inside `file`'s own text resolves — a stray `BR-QUOTE-9` is drift. */
export function findUnresolvedCitations(file: string, text: string, resolve: (id: string) => unknown): Violation[] {
  return idsCitedIn(text)
    .filter((id) => !resolve(id))
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
    ...files.flatMap((file) => findUnresolvedCitations(file, readRepoFile(ctx, file), resolve)),
  ];

  return {
    violations: violations.map(formatViolation),
    wishes: findWishes(knowledge.entries).map(formatViolation),
    proposals: findProposals(knowledge.entries).map(formatViolation),
  };
}
