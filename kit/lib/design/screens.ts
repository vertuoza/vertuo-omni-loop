// PRD 1407: the screen library — a folder (`design.screens`) of one Markdown file per screen, each a
// front matter (`screen`, `status`, who locked it, when and in which words, its mockup, the paths it
// `implements`, its `routes`, the screen it `supersedes`), then dated amendment lines, then its
// sections. `omni design screens` lists it; there is no hand-kept index. A file that does not read is
// named, never skipped in silence. The kit ships the shape only: every screen is the repository's.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { messageOf } from '../narrow.ts';

/** The three states a screen may be in, in its life's order. */
const SCREEN_STATUSES = ['draft', 'locked', 'superseded'] as const;

/** One screen of the library, as its file says it. */
export type Screen = {
  readonly file: string;
  readonly screen: string;
  readonly status: (typeof SCREEN_STATUSES)[number];
  readonly lockedBy: string | null;
  readonly lockedOn: string | null;
  readonly quote: string | null;
  readonly mock: string | null;
  readonly implements: readonly string[];
  readonly routes: readonly string[];
  readonly supersedes: string | null;
  /** Each `> Amended <date> · @login · "<quote>": <what changed>` line, as written. */
  readonly amendments: readonly string[];
  /** Each `## <heading>` section's body, trimmed, by heading. */
  readonly sections: Readonly<Record<string, string>>;
};

/** The library read: its screens sorted by name, and one line per file that does not read. */
export type Library = { readonly screens: readonly Screen[]; readonly problems: readonly string[] };

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const AMENDMENT = /^> Amended /;
const SECTION = /^## (.+?)\s*$/;

const name = (field: string) => z.string({ message: `${field} must be text` }).trim().min(1, `${field} is required`);
const optional = (field: string) => name(field).nullable().default(null);
const list = (field: string) => z.array(name(field), { message: `${field} must be a bracketed list, e.g. [a, b]` }).nullable().default([]).transform((value) => value ?? []);
// YAML reads an unquoted date as text under its core schema; a number or a quoted date reads the same.
const date = z.coerce.string().regex(DATE, 'locked-on must be a YYYY-MM-DD date').nullable().default(null);

const ScreenFrontMatter = z
  .object({
    screen: name('screen'),
    status: z.enum(SCREEN_STATUSES, { message: `status must be one of: ${SCREEN_STATUSES.join(', ')}` }),
    'locked-by': optional('locked-by'),
    'locked-on': date,
    quote: optional('quote'),
    mock: optional('mock'),
    implements: list('implements'),
    routes: list('routes'),
    supersedes: optional('supersedes'),
  })
  .strict();

/** The amendment lines and `## ` sections of a screen's body. */
function readBody(body: string): Pick<Screen, 'amendments' | 'sections'> {
  const amendments: string[] = [];
  const sections: Record<string, string[]> = {};
  let current: string[] | null = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = SECTION.exec(line);
    if (heading) {
      current = sections[heading[1] as string] = [];
    } else if (current) {
      current.push(line);
    } else if (AMENDMENT.test(line)) {
      amendments.push(line.trim());
    }
  }
  return { amendments, sections: Object.fromEntries(Object.entries(sections).map(([heading, lines]) => [heading, lines.join('\n').trim()])) };
}

/** One screen file's text read into a screen, or the one line that says why it does not read. */
export function parseScreen(text: string, file: string): { ok: true; screen: Screen } | { ok: false; problem: string } {
  const fail = (why: string) => ({ ok: false as const, problem: `${file}: ${why}` });
  const fence = FRONT_MATTER.exec(text);
  if (!fence) return fail('no front matter — a screen starts with a --- block');
  let raw: unknown;
  try {
    raw = parse(fence[1] as string);
  } catch (error) {
    return fail(`front matter is not YAML — ${messageOf(error).split('\n')[0]}`);
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fail('front matter is not YAML key: value lines');
  const read = ScreenFrontMatter.safeParse(raw);
  if (!read.success) {
    const issue = read.error.issues[0] as z.core.$ZodIssue;
    const keys = issue.code === 'unrecognized_keys' ? `: ${issue.keys.join(', ')}` : '';
    return fail(`${issue.message}${keys}`);
  }
  const { screen, status, quote, mock, implements: paths, routes, supersedes } = read.data;
  const lockedBy = read.data['locked-by'];
  const lockedOn = read.data['locked-on'];
  if (status === 'locked') {
    const missing = [['locked-by', lockedBy], ['locked-on', lockedOn], ['quote', quote]].flatMap(([field, value]) => (value === null ? [field] : []));
    if (missing.length) return fail(`a locked screen needs locked-by, locked-on and quote — missing ${missing.join(', ')}`);
  }
  const body = readBody(text.slice(fence[0].length));
  return { ok: true, screen: { file, screen, status, lockedBy, lockedOn, quote, mock, implements: paths, routes, supersedes, ...body } };
}

/** The `.md` files directly in `dir`, each read; a folder that does not exist is an empty library. */
export function readScreens(dir: string): Library {
  let files: string[];
  try {
    files = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return { screens: [], problems: [] };
  }
  const screens: Screen[] = [];
  const problems: string[] = [];
  for (const file of files) {
    const read = parseScreen(readFileSync(join(dir, file), 'utf8'), file);
    if (read.ok) screens.push(read.screen);
    else problems.push(read.problem);
  }
  screens.sort((a, b) => a.screen.localeCompare(b.screen) || a.file.localeCompare(b.file));
  return { screens, problems };
}

/** The lines `omni design screens` prints: one aligned line per screen, then each file that does not read. */
export function formatScreens({ screens, problems }: Library, dir: string): string[] {
  const unread = problems.map((problem) => `does not read: ${dir.replace(/\/*$/, '/')}${problem}`);
  if (screens.length === 0) return [`screens: none in ${dir}`, ...unread];
  const rows = screens.map((s) => [
    s.screen,
    s.status,
    s.lockedBy === null && s.lockedOn === null ? '—' : [s.lockedBy, s.lockedOn].filter((part) => part !== null).join(' '),
    s.routes.length ? s.routes.join(', ') : '—',
  ]);
  const widths = [0, 1, 2].map((column) => Math.max(...rows.map((row) => (row[column] as string).length)));
  return [...rows.map((row) => row.map((cell, column) => (column < 3 ? cell.padEnd(widths[column] as number) : cell)).join('  ')), ...unread];
}
