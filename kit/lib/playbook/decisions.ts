/**
 * **The decision records, read live** (PRD #45, slice s3). The decisions form says where the
 * records live and how one is written; the list itself is never kept by hand. Every time it is
 * asked, this module reads `ctx.layout.adrDir`: each record's number and title, each number more
 * than one record uses, and the next free number.
 *
 * A record is a file directly in that folder named `NNNN-<slug>.md`, four digits, as `ADR-NNNN`
 * resolves it; its title is its first `# ` heading, as written. Any other file (the folder's
 * `README.md`, the decisions form itself when the records live beside it) is no record. The next
 * free number is one past the highest in use: a gap is a record that was never written or was
 * removed, never a number to hand out again.
 *
 * A record may also tag itself on that header line, `**Layers:** db, auth` and `**Domain:** ask`
 * (PRD 2346): the knowledge lookup reaches it from a file of that layer or domain.
 *
 * A record names the PRD it came from on its header line (`**PRD:** #7`, PRD 1797), above its first
 * `## ` section: the knowledge graph joins an entry to the records of its PRD by it. A record
 * without that header names no PRD.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../context.ts';
import { PrdNumberSchema, type PrdNumber } from '../ids.ts';
import { levelCopies, type Level } from '../knowledge-tree/levels.ts';

/**
 * One decision record: its four-digit number, its file, its title (`null` with no `# ` heading), and
 * the PRD its header names (`null` with no `**PRD:** #n`).
 */
export type DecisionRecord = {
  /**
   * The knowledge-tree level a record is read from (PRD 2416), set only on a record another level
   * holds: a repository's own record has no `level` key, so `omni kb show decisions --json` reads as
   * it always has. Read it with `levelOf`.
   */
  level?: Level;
  number: string;
  file: string;
  title: string | null;
  prd: PrdNumber | null;
  /** The layer words of the header's `**Layers:** db, auth` (PRD 2346), as written; absent with none. */
  layers?: string[];
  /** The knowledge domain of the header's `**Domain:** ask`; `null` with none. */
  domain?: string | null;
};

/** The decision records, read live. */
export type Decisions = {
  dir: string;
  records: DecisionRecord[];
  shared: { number: string; files: string[] }[];
  next: string;
};

const RECORD = /^(\d{4})-.+\.md$/;
const TITLE = /^#\s+(.+?)\s*$/m;
const PRD_HEADER = /\*\*PRD:\*\*\s*#(\d+)\b/;
const LAYERS_HEADER = /\*\*Layers:\*\*[ \t]*([^·\n]*)/;
const DOMAIN_HEADER = /\*\*Domain:\*\*[ \t]*([^·\s]*)/;

/** The text above a record's first `## ` section. */
const headerOf = (text: string): string => text.split(/^##\s/m)[0] ?? '';

/** The layer words a record's header lists, as written, backticks stripped. */
function headerLayers(text: string): string[] {
  const value = LAYERS_HEADER.exec(headerOf(text))?.[1] ?? '';
  return value
    .split(',')
    .map((part) => part.replace(/`/g, '').trim())
    .filter(Boolean);
}

/** The domain a record's header names, `null` with none. */
function headerDomain(text: string): string | null {
  const value = (DOMAIN_HEADER.exec(headerOf(text))?.[1] ?? '').replace(/`/g, '');
  return value === '' ? null : value;
}

/** The PRD a record's header names: the `**PRD:** #n` above its first `## ` section, or `null`. */
function headerPrd(text: string): PrdNumber | null {
  const prd = PrdNumberSchema.safeParse(Number(PRD_HEADER.exec(headerOf(text))?.[1]));
  return prd.success ? prd.data : null;
}

/** The tags a record's header carries, a key only when it has the tag: a record with none reads as before. */
function tagsOf(text: string): Pick<DecisionRecord, 'layers' | 'domain'> {
  const layers = headerLayers(text);
  const domain = headerDomain(text);
  return { ...(layers.length > 0 ? { layers } : {}), ...(domain === null ? {} : { domain }) };
}

/** The level a record is read from: `repo` for the repository's own. */
export const levelOf = (record: Pick<DecisionRecord, 'level'>): Level => record.level ?? 'repo';

/** The records of one folder, in number order (a shared number's files by name), each tagged with `level`. */
function readFolder(root: string, dir: string, level: Level): DecisionRecord[] {
  const absolute = join(root, dir);
  const names = existsSync(absolute)
    ? readdirSync(absolute, { withFileTypes: true })
        .filter((entry) => entry.isFile() && RECORD.test(entry.name))
        .map((entry) => entry.name)
        .sort()
    : [];
  return names.map((name): DecisionRecord => {
    const file = `${dir}/${name}`;
    const text = readFileSync(join(root, file), 'utf8');
    return {
      ...(level === 'repo' ? {} : { level }),
      number: name.match(RECORD)?.[1] ?? '',
      file,
      title: text.match(TITLE)?.[1] ?? null,
      prd: headerPrd(text),
      ...tagsOf(text),
    };
  });
}

/**
 * `{ dir, records: [{ level, number, file, title, prd }], shared: [{ number, files }], next }`: the
 * repository's records in number order (a shared number's files by name), then, bottom-up (PRD 2416),
 * the records of the plan repository's and the Omni settings' copies whose number nothing nearer
 * holds, each level in number order. `title` is `null` when the file has no `# ` heading. `shared`
 * and `next` are the repository's own: a copy's number never shifts the next free one. A context
 * with no `config`, or a checkout with no copy, reads the repository alone. A folder that does not
 * exist has no records.
 */
export function readDecisions({
  ctx,
}: {
  ctx: { root: string; layout: { adrDir: string }; config?: Context['config'] };
}): Decisions {
  const dir = ctx.layout.adrDir.replace(/\/+$/, '');
  const records = readFolder(ctx.root, dir, 'repo');

  const byNumber = new Map<string, string[]>();
  for (const record of records) byNumber.set(record.number, [...(byNumber.get(record.number) ?? []), record.file]);
  const shared = [...byNumber].filter(([, files]) => files.length > 1).map(([number, files]) => ({ number, files }));

  const highest = records.reduce((max, record) => Math.max(max, Number(record.number)), 0);

  const held = new Set(records.map((record) => record.number));
  const inherited: DecisionRecord[] = [];
  if (ctx.config) {
    for (const copy of levelCopies({ ctx: { root: ctx.root, config: ctx.config } })) {
      const own = readFolder(ctx.root, copy.ctx.layout.adrDir.replace(/\/+$/, ''), copy.level);
      const taken = new Set(held);
      for (const record of own) if (!taken.has(record.number)) inherited.push(record);
      for (const record of own) held.add(record.number);
    }
  }
  return { dir, records: [...records, ...inherited], shared, next: String(highest + 1).padStart(4, '0') };
}
