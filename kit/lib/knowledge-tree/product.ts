/**
 * **The product side of the knowledge tree** (PRD 2416, s4). Product knowledge (the registers: what
 * the product is and must do) reads the tree **top-down**, the opposite way to the tech side
 * (`./levels.ts`): every level's entries apply, the Omni settings' first, then the plan repository's,
 * then the repository's own. A lower level may add to the levels above it, never contradict them.
 *
 * Each level above the repository is read from its local copy (`levelFolder`), laid out as a
 * knowledge folder is (`product/`, `domains/<domain>/`, `cross-domain/`) and read through the one
 * parser, `registers.ts`. A copy that is absent, or holds no register, adds nothing: a repository with
 * no other level reads its own entries exactly as the parser does.
 *
 * **A contradiction**, read from the registers' own fields: a lower level's entry that carries the id
 * of a higher level's entry, but says something else (another statement, its spacing aside, or
 * another kind). An entry under a new id only adds; one that repeats a higher entry word for word
 * only restates it.
 */
import { readKnowledge, type KnowledgeCtx, type KnowledgeEntry } from '../knowledge/registers.ts';
import { levelFolder, type Level } from './levels.ts';

/** The product side's levels, top-down: the highest first. The kit holds no product knowledge. */
export const PRODUCT_LEVELS = Object.freeze(['omni settings', 'plan repo', 'repo'] as const satisfies readonly Level[]);

/** One level of the product side. */
export type ProductLevel = (typeof PRODUCT_LEVELS)[number];

/** One register entry, with the level it was read from. */
export type LevelEntry = { level: ProductLevel; entry: KnowledgeEntry };

/**
 * A lower level's entry that says otherwise than a higher level's, under the same id: `on` is what
 * differs first, its kind or else its statement.
 */
export type Contradiction = { lower: LevelEntry; higher: LevelEntry; on: 'kind' | 'statement' };

/** Where `level`'s knowledge folder lies in the checkout: the repository's own, or its copy. */
function knowledgeRootOf(ctx: KnowledgeCtx, level: ProductLevel): string {
  return level === 'repo' ? ctx.layout.knowledgeRoot : levelFolder(level);
}

/** Every level's register entries, the highest level first, each named with its level. */
export function productEntries({ ctx }: { ctx: KnowledgeCtx }): LevelEntry[] {
  return PRODUCT_LEVELS.flatMap((level) => {
    const { entries } = readKnowledge({ ctx: { root: ctx.root, layout: { knowledgeRoot: knowledgeRootOf(ctx, level) } } });
    return entries.map((entry) => ({ level, entry }));
  });
}

/** An entry's statement as compared between levels: its spacing collapsed. */
export function statementOf(entry: KnowledgeEntry): string {
  return entry.statement.replace(/\s+/g, ' ').trim();
}

/** What differs first between two entries of one id, or `null` when the lower one only restates the higher. */
function difference(lower: KnowledgeEntry, higher: KnowledgeEntry): Contradiction['on'] | null {
  if (lower.kind !== higher.kind) return 'kind';
  return statementOf(lower) === statementOf(higher) ? null : 'statement';
}

/**
 * Every lower entry that contradicts a higher one, given `entries` the highest level first (as
 * {@link productEntries} reads them): each pair once, the lower entries in reading order, each
 * against the higher levels top-down. Two entries of one level are never compared.
 */
export function findContradictions(entries: readonly LevelEntry[]): Contradiction[] {
  return entries.flatMap((lower, index) =>
    entries.slice(0, index).flatMap((higher) => {
      if (higher.level === lower.level || higher.entry.id !== lower.entry.id) return [];
      const on = difference(lower.entry, higher.entry);
      return on === null ? [] : [{ lower, higher, on }];
    }),
  );
}
