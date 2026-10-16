/**
 * **A bug record born on the server is checked and pushed** (PRD 2011, slice s6): what
 * `omni bug check --product <key> <file>` and `omni bug push --product <key> (--new | --bug <n>) <file>`
 * do. The record is a `bug.md` anywhere (a scratch folder, most often), shaped as `/omni:mega-bug-fix`
 * writes it: a `# <title>` heading, a `## Fixes` table (`| order | repository | pull request | what
 * changes |`) and a `- **<repository>:** …` line per row in its Reproduction and Guard sections. It has
 * no issue and no folder of the delivery: the server numbers it `<key>-B<n>` and keeps one Fixes row per
 * fix.
 *
 * Its rows are checked against the product's own repositories, never `plan.targets`. The kit does not
 * hold them: a check call to the same route as a push (`check: true`, which writes nothing) answers the
 * product's repositories, and {@link gradeProductBug} grades the rows against those. A push runs the same
 * check first, so a row naming a repository outside the product is refused by name and nothing is
 * written; the server refuses it too.
 */
import { z } from 'zod';
import { ProductBugIdSchema, productBugParts } from '../ids.ts';
import type { ProductBugId } from '../ids.ts';
import { callLine } from '../roadmap/product.ts';
import { boldField, tableRows } from './fixes.ts';
import { parseSections } from './verdict.ts';

/** What a product bug's calls need of a signed-in client. */
export type BugClient = { pushBug: (body: unknown) => Promise<unknown> };

/** A repository of the product, as the server answers it: its `owner/name`. */
export type ProductRepository = { repository: string; readOnly: boolean };

/** One Fixes row as the server stores it. */
export type BugRow = { repo: string; pull: number | null; changes: string; reproduction: string; guard: string };

/** A bug record read: its title and its Fixes rows as written (repositories by slug or short name). */
export type ParsedBug = { title: string; rows: WrittenRow[] };
type WrittenRow = { order: string; repository: string; pull: string; changes: string };

const REFERENCE = /^(?:([\w.-]+\/[\w.-]+))?#(\d+)$|github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/;

/** The record's rows and title, or the lines it stops on. */
export function parseProductBug(text: string): { ok: true; bug: ParsedBug; sections: ReadonlyMap<string, string> } | { ok: false; errors: string[] } {
  const title = /^#\s+(.+?)\s*#*\s*$/m.exec(text)?.[1]?.trim() ?? '';
  const sections = parseSections(text);
  const errors: string[] = [];
  if (title === '') errors.push('the record has no "# <title>" heading.');
  else if (title.length > 200) errors.push('the title is over 200 characters.');
  const fixes = sections.get('Fixes');
  const rows = tableRows(fixes ?? '');
  if (fixes === undefined || rows.length === 0) errors.push('the "## Fixes" table has no rows.');
  if (rows.length > 50) errors.push('the "## Fixes" table has more than 50 rows.');
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    sections,
    bug: { title, rows: rows.map(([order = '', repository = '', pull = '', changes = '']) => ({ order, repository, pull, changes })) },
  };
}

/** The product's repository a cell names, by its slug or by the name after its `/`. */
function repositoryOf(repositories: readonly ProductRepository[], cell: string): ProductRepository | undefined {
  const wanted = cell.toLowerCase();
  return repositories.find((r) => r.repository.toLowerCase() === wanted) ?? repositories.find((r) => r.repository.split('/')[1]?.toLowerCase() === wanted);
}

/** The pull request a cell names in `slug`: its number, null for none yet, or the line saying what is wrong. */
function pullOf(slug: string, cell: string): { pull: number | null } | { error: string } {
  if (cell === '' || /^(?:—|-|none|tbd)$/i.test(cell)) return { pull: null };
  const match = REFERENCE.exec(cell);
  if (match === null) return { error: `pull request "${cell}" is not #41, ${slug}#41 or a link.` };
  const named = match[1] ?? match[3];
  const number = Number(match[2] ?? match[4]);
  if (named !== undefined && named.toLowerCase() !== slug.toLowerCase()) return { error: `the pull request ${named}#${number} is not in ${slug}.` };
  return { pull: number };
}

/** A grade: the rows as the server stores them, or every violation, each naming its row. */
export type GradedBug = { rows: BugRow[]; violations: string[] };

/**
 * Grades a record's rows against the repositories of the product keyed `key`: each row's repository is
 * one of them (named when not), not read-only, its pull request in that repository and on one row only,
 * the orders run 1..k, and the Reproduction and Guard sections give a line for the row's repository.
 */
export function gradeProductBug(bug: ParsedBug, sections: ReadonlyMap<string, string>, { key, repositories }: { key: string; repositories: readonly ProductRepository[] }): GradedBug {
  const violations: string[] = [];
  const rows: BugRow[] = [];
  const seenPulls = new Set<string>();
  bug.rows.forEach((written, at) => {
    const index = at + 1;
    const found = repositoryOf(repositories, written.repository);
    if (found === undefined) {
      violations.push(`Fixes row ${index}: ${written.repository} is not a repository of product ${key} (${repositories.map((r) => r.repository).join(', ')}).`);
      return;
    }
    const { row, problems } = gradeRow({ written, index, found, sections, seenPulls });
    violations.push(...problems.map((problem) => `Fixes row ${index} (${found.repository}): ${problem}`));
    rows.push(row);
  });
  return { rows, violations };
}

/** One row in a repository of the product: its stored shape, and what is wrong with it. */
function gradeRow({ written, index, found, sections, seenPulls }: {
  written: WrittenRow;
  index: number;
  found: ProductRepository;
  sections: ReadonlyMap<string, string>;
  seenPulls: Set<string>;
}): { row: BugRow; problems: string[] } {
  const slug = found.repository;
  const name = slug.split('/')[1] ?? slug;
  const pull = pullOf(slug, written.pull);
  const line = (section: string) => boldField(sections.get(section) ?? '', slug) || boldField(sections.get(section) ?? '', name) || '';
  const reproduction = line('Reproduction');
  const guard = line('Guard');
  const problems = [
    written.order === String(index) ? null : `order "${written.order}", where ${index} is next.`,
    found.readOnly ? 'the repository is read-only in the product.' : null,
    'error' in pull ? pull.error : repeatedPull(seenPulls, slug, pull.pull),
    written.changes === '' ? 'no "what changes".' : null,
    reproduction === '' ? 'the Reproduction has no line for it.' : null,
    guard === '' ? 'the Guard has no line for it.' : null,
  ].filter((problem) => problem !== null);
  return { row: { repo: slug, pull: 'pull' in pull ? pull.pull : null, changes: written.changes, reproduction, guard }, problems };
}

/** The line saying a pull request is on an earlier row, else null; remembers it. */
function repeatedPull(seen: Set<string>, slug: string, pull: number | null): string | null {
  if (pull === null) return null;
  const id = `${slug.toLowerCase()}#${pull}`;
  if (seen.has(id)) return `the pull request ${slug}#${pull} is on an earlier row.`;
  seen.add(id);
  return null;
}

/** The body of a push or of its check. */
function productBugPushBody({ key, seq, repo, title, record, rows, check = false }: {
  key: string;
  seq: number | null;
  repo: string | null;
  title: string;
  record: string;
  rows: readonly BugRow[];
  check?: boolean;
}) {
  return {
    productKey: key,
    ...(seq === null ? { new: true as const } : { bug: seq }),
    ...(repo === null ? {} : { repo }),
    ...(check ? { check: true as const } : {}),
    title, record, rows,
  };
}

const CheckReply = z.object({
  product: z.object({ key: z.string(), name: z.string() }),
  repositories: z.array(z.object({ repository: z.string(), readOnly: z.boolean() })),
});

/** A record read and graded: its rows and every violation, or the lines it stops on. */
export type GradedProductBug =
  | { ok: true; title: string; record: string; rows: BugRow[]; violations: string[] }
  | { ok: false; lines: string[] };

/** The product's repositories as the server answers a check, or the line saying why it could not. */
async function readRepositories(client: BugClient, body: unknown, key: string): Promise<ProductRepository[] | string> {
  const unread = (why: string) => `the repositories of product ${key} could not be read: ${why}`;
  const reply = await client.pushBug(body).catch((error: unknown) => ({ failed: callLine(error) }));
  if (isFailure(reply)) return unread(reply.failed);
  const read = CheckReply.safeParse(reply);
  return read.success ? read.data.repositories : unread('the reply is not a check');
}

/** What a failed call is turned into, to be told from the app's reply. */
const isFailure = (reply: unknown): reply is { failed: string } => typeof reply === 'object' && reply !== null && 'failed' in reply;

/** Parses `record` and grades it against the repositories of the product keyed `key`, which the server answers. */
export async function gradeBugFile({ key, repo, record, client }: { key: string; repo: string | null; record: string; client: BugClient }): Promise<GradedProductBug> {
  const parsed = parseProductBug(record);
  if (!parsed.ok) return { ok: false, lines: parsed.errors };
  const body = productBugPushBody({ key, seq: null, repo, title: parsed.bug.title, record, rows: [], check: true });
  const repositories = await readRepositories(client, body, key);
  if (typeof repositories === 'string') return { ok: false, lines: [repositories] };
  const graded = gradeProductBug(parsed.bug, parsed.sections, { key, repositories });
  return { ok: true, title: parsed.bug.title, record, rows: graded.rows, violations: graded.violations };
}

/** A bug argument for product `key`: `74` or `<key>-B74`; null when it is neither, or another product's. */
export function bugSeqArg(key: string, value: string): number | null {
  if (/^[1-9]\d{0,9}$/.test(value)) return Number(value);
  const id = ProductBugIdSchema.safeParse(value);
  if (!id.success) return null;
  const parts = productBugParts(id.data);
  return parts.key === key ? parts.seq : null;
}

const PushReply = z.object({
  dossierId: z.string().min(1),
  bug: ProductBugIdSchema,
  created: z.boolean(),
  rows: z.array(z.object({ position: z.number(), repository: z.string(), pull: z.number().nullable(), state: z.string() })),
  added: z.array(z.object({ kind: z.string(), version: z.number() })),
  unchanged: z.array(z.string()),
});

export type ProductBugPushed = { bug: ProductBugId; page: string; created: boolean; rows: number; added: string[]; unchanged: string[] };

/** What a push prints: the bug's id on a line of its own, then what the push did and the page. */
export function bugPushedLines({ bug, page, created, rows, added, unchanged }: ProductBugPushed): string {
  const versions = added.length > 0 ? `added ${added.join(', ')}` : 'no new version';
  return `${bug}\n${created ? 'created' : 'updated'} · ${rows} row(s) · ${versions}${unchanged.length > 0 ? ` · unchanged ${unchanged.join(', ')}` : ''} — ${page}`;
}

/** Sends a graded record: to the product's next bug when `seq` is null, else to `<key>-B<seq>`. */
export async function pushProductBug({ key, seq, repo, graded, askUrl, client }: {
  key: string;
  seq: number | null;
  repo: string | null;
  graded: { title: string; record: string; rows: readonly BugRow[] };
  askUrl: string;
  client: BugClient;
}): Promise<{ ok: true; pushed: ProductBugPushed } | { ok: false; line: string }> {
  let reply: unknown;
  try {
    reply = await client.pushBug(productBugPushBody({ key, seq, repo, title: graded.title, record: graded.record, rows: graded.rows }));
  } catch (error) {
    return { ok: false, line: callLine(error) };
  }
  const read = PushReply.safeParse(reply);
  if (!read.success) return { ok: false, line: 'refused (no bug in the reply)' };
  const { dossierId, bug, created, rows, added, unchanged } = read.data;
  return {
    ok: true,
    pushed: { bug, page: `${askUrl.replace(/\/+$/, '')}/bugs/${dossierId}`, created, rows: rows.length, added: added.map((item) => `${item.kind} v${item.version}`), unchanged },
  };
}
