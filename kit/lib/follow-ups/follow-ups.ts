// The open points a fix or a review leaves (PRD 2739): one markdown file per point in
// `<paths.delivery>/follow-ups/`, named `<yyyy-mm-dd>-<slug>.md`. Pure functions plus two small
// folder readers and writers; no network call.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProductBugIdSchema } from '../ids.ts';

export const FOLLOW_UPS_DIR = 'follow-ups';
const MAX_TEXT = 300;
const MAX_REPOS = 10;
const MAX_SLUG_WORDS = 6;
const MAX_SLUG_LENGTH = 60;

const BUG_SOURCE = /^bug #[1-9]\d*$/;
const PRD_SOURCE = /^PRD #[1-9]\d* · https?:\/\/\S+$/;
const REPO = /^[\w.-]+\/[\w.-]+$/;

/** A point as the folder holds it. */
export type FollowUp = { file: string; source: string; date: string; repos: string[]; text: string };

/** Whether `source` is `bug #<n>`, `<key>-B<n>` or `PRD #<n> · <url>`. */
function validSource(source: string): boolean {
  return BUG_SOURCE.test(source) || PRD_SOURCE.test(source) || ProductBugIdSchema.safeParse(source).success;
}

/** The text with every run of whitespace collapsed to one space: how two points are compared. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The point's first words in kebab-case, at most six; `point` when nothing usable is left. */
function slugOf(text: string): string {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')
    .slice(0, MAX_SLUG_WORDS);
  const slug = words.join('-').slice(0, MAX_SLUG_LENGTH).replace(/-$/, '');
  return slug === '' ? 'point' : slug;
}

/** The file name of a point written on `date`. */
function fileNameOf(date: string, text: string): string {
  return `${date}-${slugOf(text)}.md`;
}

/** The file's content. */
function render(point: { source: string; date: string; repos: readonly string[]; text: string }): string {
  const repos = point.repos.length === 0 ? '' : `repos: [${point.repos.join(', ')}]\n`;
  return `---\nsource: ${point.source}\ndate: ${point.date}\n${repos}---\n\n${point.text.trim()}\n`;
}

/** A file read back, or `null` when it is no follow-up file. */
function parseFile(file: string, content: string): FollowUp | null {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(content);
  if (match === null) return null;
  const head = new Map<string, string>();
  for (const line of (match[1] ?? '').split('\n')) {
    const cut = line.indexOf(':');
    if (cut > 0) head.set(line.slice(0, cut).trim(), line.slice(cut + 1).trim());
  }
  const source = head.get('source');
  const date = head.get('date');
  if (source === undefined || date === undefined) return null;
  const repos = (head.get('repos') ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((repo) => repo.trim())
    .filter((repo) => repo !== '');
  return { file, source, date, repos, text: (match[2] ?? '').trim() };
}

/** Every point of the folder `dir`, oldest first (then by file name); `[]` when it is missing. */
export function readFollowUps(dir: string): FollowUp[] {
  if (!existsSync(dir)) return [];
  const points: FollowUp[] = [];
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.md')).sort()) {
    const point = parseFile(name, readFileSync(join(dir, name), 'utf8'));
    if (point !== null) points.push(point);
  }
  return points.sort((a, b) => a.date.localeCompare(b.date) || a.file.localeCompare(b.file));
}

/** The point of `points` with this `source` and this text (whitespace collapsed), or `undefined`. */
function findPoint(points: readonly FollowUp[], source: string, text: string): FollowUp | undefined {
  const wanted = collapse(text);
  return points.find((point) => point.source === source && collapse(point.text) === wanted);
}

type AddResult = { ok: true; file: string } | { ok: false; code: 1 | 2; line: string };

/** Checks and writes one point in `dir`; the result says the file written, or the one line it stops on. */
export function addFollowUp(
  dir: string,
  input: { source: string; text: string; repos: readonly string[]; date: string },
): AddResult {
  const text = input.text.trim();
  if (text === '') return { ok: false, code: 2, line: 'omni follow-up: --text is empty.' };
  if (text.length > MAX_TEXT) return { ok: false, code: 2, line: `omni follow-up: --text is over ${MAX_TEXT} characters.` };
  if (!validSource(input.source)) {
    return { ok: false, code: 2, line: "omni follow-up: --source must be 'bug #<n>', '<key>-B<n>' or 'PRD #<n> · <url>'." };
  }
  if (input.repos.length > MAX_REPOS || input.repos.some((repo) => !REPO.test(repo))) {
    return { ok: false, code: 2, line: `omni follow-up: --repos takes at most ${MAX_REPOS} owner/name entries.` };
  }
  const existing = findPoint(readFollowUps(dir), input.source, text);
  if (existing !== undefined) {
    return { ok: false, code: 1, line: `omni follow-up: ${join(dir, existing.file)} already holds this point.` };
  }
  let name = fileNameOf(input.date, text);
  for (let n = 2; existsSync(join(dir, name)); n += 1) name = `${input.date}-${slugOf(text)}-${n}.md`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), render({ source: input.source, date: input.date, repos: input.repos, text }));
  return { ok: true, file: join(dir, name) };
}
