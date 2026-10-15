/**
 * **The laws' CODEOWNERS block** (PRD 1726, slice s4).
 *
 * A change to a law clears the gate only with an approving review from a CODEOWNER of its files
 * (`law-locked`, s3). `omni kb owners` writes who that is: one block between markers
 * (`codeowners.ts`, {@link OWNERS_BEGIN}) in the CODEOWNERS file GitHub reads, owning
 *
 * - the thesis, `<knowledge>/product/thesis.md`, which names every law;
 * - every register file: each folder's `principles.md`, `rules.md` and `invariants.md`, and each
 *   cross-domain file;
 * - each locked law's test, every path its `Enforced by:` line names;
 *
 * each owned by every one of `laws.owners` and each owner's delegate (PRD 1794), never by
 * `laws.leadership`. It writes the file GitHub reads first (`.github/`, the
 * root, then the docs folder), and `.github/CODEOWNERS` when there is none, so a block never shadows a file
 * a repository already has. `omni check knowledge` goes red when the block differs from what the
 * command would write ({@link ownersBlockProblems}).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { LawOwner } from './config.ts';
import { CODEOWNERS_FILES, OWNERS_BEGIN, ownersBlock, ownersBlockIn, withOwnersBlock, type OwnedPath } from './codeowners.ts';
import { domainsDir, isLaw, LAYER_FILES, productDir, readKnowledge, type Knowledge, type KnowledgeCtx } from './knowledge/registers.ts';
import { thesisPath } from './knowledge/thesis.ts';
import { messageOf } from './narrow.ts';

/** What the block needs of the context: the knowledge folder, and `laws.owners` (their delegates included, PRD 1794). */
export type OwnersCtx = KnowledgeCtx & { config: { laws?: { owners?: readonly LawOwner[] } } };

/** The file the block goes in when the repository has no CODEOWNERS yet. */
const DEFAULT_CODEOWNERS = '.github/CODEOWNERS';

/** The paths a test's `Enforced by:` line names: comma-separated, backticks and `#anchor`s dropped. */
function testPaths(enforcedBy: string): string[] {
  return enforcedBy
    .split(',')
    .map((part) => (part.replace(/`/g, '').trim().split('#')[0] ?? '').trim())
    .filter(Boolean);
}

/** Every path the block owns, in the block's order: the thesis, the register files, then each law's test. */
function lawOwnedPaths(ctx: KnowledgeCtx, knowledge: Knowledge = readKnowledge({ ctx })): OwnedPath[] {
  const registers = 'The thesis and the registers: what the product promises, and its laws.';
  const layers = (dir: string, files: readonly string[]) => Object.keys(LAYER_FILES).filter((name) => files.includes(name)).map((name) => `${dir}/${name}`);
  const files = [
    thesisPath(ctx),
    ...layers(productDir(ctx), knowledge.productFiles),
    ...knowledge.domains.flatMap((domain) => layers(`${domainsDir(ctx)}/${domain.name}`, domain.files)),
    ...knowledge.crossDomainFiles.map(({ file }) => file),
  ];
  const tests = knowledge.entries
    .filter((entry) => isLaw(entry) && entry.enforced && entry.enforcedBy !== null)
    .flatMap((entry) => testPaths(entry.enforcedBy ?? '').map((path) => ({ path, why: `law ${entry.id}: its test.` })));
  return [...files.map((path) => ({ path, why: registers })), ...tests];
}

/** The block `omni kb owners` would write now. */
function expectedOwnersBlock(ctx: OwnersCtx, knowledge: Knowledge = readKnowledge({ ctx })): string {
  return ownersBlock(lawOwnedPaths(ctx, knowledge), ctx.config.laws?.owners ?? []);
}

/** The CODEOWNERS file GitHub reads, and its text; {@link DEFAULT_CODEOWNERS} and `null` when there is none. */
function codeownersFile(ctx: { root: string }): { file: string; text: string | null } {
  for (const file of CODEOWNERS_FILES) {
    const absolute = join(ctx.root, file);
    if (existsSync(absolute)) return { file, text: readFileSync(absolute, 'utf8') };
  }
  return { file: DEFAULT_CODEOWNERS, text: null };
}

/**
 * Whether the block is out of date, one plain sentence per problem: missing while a law is locked,
 * different from what `omni kb owners` would write, or markers that do not pair up. Nothing is asked
 * while `laws.owners` is empty (the lock count's check refuses a lock then), nor of a repository that
 * locked nothing and holds no block.
 */
export function ownersBlockProblems(ctx: OwnersCtx, knowledge: Knowledge = readKnowledge({ ctx })): string[] {
  if ((ctx.config.laws?.owners ?? []).length === 0) return [];
  const { file, text } = codeownersFile(ctx);
  let current: string | null;
  try {
    current = text === null ? null : ownersBlockIn(text);
  } catch (error) {
    return [`${file}: ${messageOf(error)}.`];
  }
  const laws = knowledge.entries.filter(isLaw).length;
  if (current === null) {
    if (laws === 0) return [];
    return [`${file}: has no "${OWNERS_BEGIN}" block, and ${laws} law(s) are locked — run omni kb owners, so a change to a law needs its owner's approval.`];
  }
  if (current === expectedOwnersBlock(ctx, knowledge)) return [];
  return [`${file}: its "${OWNERS_BEGIN}" block is out of date with the locked laws and laws.owners — run omni kb owners.`];
}

/**
 * Writes the block into the CODEOWNERS file GitHub reads: `{ file, wrote, paths }`, `wrote` false when
 * it was already up to date. Throws, naming the file and writing nothing, when its markers do not pair up.
 */
export function writeOwnersBlock(ctx: OwnersCtx): { file: string; wrote: boolean; paths: number } {
  const knowledge = readKnowledge({ ctx });
  const { file, text } = codeownersFile(ctx);
  const block = expectedOwnersBlock(ctx, knowledge);
  const paths = new Set(lawOwnedPaths(ctx, knowledge).map(({ path }) => path)).size;
  let next: string;
  try {
    next = withOwnersBlock(text, block);
  } catch (error) {
    throw new Error(`${file}: ${messageOf(error)}.`, { cause: error });
  }
  if (next === text) return { file, wrote: false, paths };
  const absolute = join(ctx.root, file);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, next);
  return { file, wrote: true, paths };
}
