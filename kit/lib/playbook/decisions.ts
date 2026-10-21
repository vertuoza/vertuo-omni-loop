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
import { PrdNumberSchema, type PrdNumber } from '../ids.ts';

/**
 * One decision record: its four-digit number, its file, its title (`null` with no `# ` heading), and
 * the PRD its header names (`null` with no `**PRD:** #n`).
 */
export type DecisionRecord = {
  number: string;
  file: string;
  title: string | null;
  prd: PrdNumber | null;
  /** The layer words of the header's `**Layers:** db, auth` (PRD 2346), as written; `[]` with none (absent on a record built by hand). */
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

/**
 * `{ dir, records: [{ number, file, title, prd }], shared: [{ number, files }], next }`: the records in
 * number order (a shared number's files by name), `title` `null` when the file has no `# `
 * heading, `next` the next free number, four digits. A folder that does not exist has no records.
 */
export function readDecisions({ ctx }: { ctx: { root: string; layout: { adrDir: string } } }): Decisions {
  const dir = ctx.layout.adrDir.replace(/\/+$/, '');
  const absolute = join(ctx.root, dir);
  const names = existsSync(absolute)
    ? readdirSync(absolute, { withFileTypes: true })
        .filter((entry) => entry.isFile() && RECORD.test(entry.name))
        .map((entry) => entry.name)
        .sort()
    : [];

  const records = names.map((name): DecisionRecord => {
    const file = `${dir}/${name}`;
    const text = readFileSync(join(ctx.root, file), 'utf8');
    return {
      number: name.match(RECORD)?.[1] ?? '',
      file,
      title: text.match(TITLE)?.[1] ?? null,
      prd: headerPrd(text),
      layers: headerLayers(text),
      domain: headerDomain(text),
    };
  });

  const byNumber = new Map<string, string[]>();
  for (const record of records) byNumber.set(record.number, [...(byNumber.get(record.number) ?? []), record.file]);
  const shared = [...byNumber].filter(([, files]) => files.length > 1).map(([number, files]) => ({ number, files }));

  const highest = records.reduce((max, record) => Math.max(max, Number(record.number)), 0);
  return { dir, records, shared, next: String(highest + 1).padStart(4, '0') };
}
