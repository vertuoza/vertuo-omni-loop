// PRD 1407: `omni check design` — a decision someone locked is not changed without them. A locked
// screen of the library (`design.screens`) or a locked law of the `design` form's `language` slot
// changes only with a new, dated amendment line, its old ones kept; a locked screen is superseded,
// never deleted. Also refused: a screen whose front matter does not read, a `superseded` screen no
// other screen names, and a lock or amendment line that does not read. A draft, and a law with no
// lock line, change freely. The grading is pure, on two snapshots (the working tree, and the base);
// reading the base through git is the one impure part. The kit ships no law and no screen.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecText } from '../context.ts';
import { parseForm } from '../playbook/forms.ts';
import { parseScreen, type Screen } from './screens.ts';

/** The screen library and the design form, as one side of the comparison holds them. */
export type DesignSnapshot = {
  /** Each `.md` file directly in the library folder, by file name, as text. */
  readonly screens: Readonly<Record<string, string>>;
  /** The design form's text, or null when it has none. */
  readonly form: string | null;
};

/** One law of the `language` slot: its heading, its lock line, its text and its amendment lines. */
type Law = {
  readonly heading: string;
  /** The `🔒 …` line, as written, or null for a law no one locked. */
  readonly lock: string | null;
  /** Every line but the amendment lines, trailing space dropped: what an amendment must cover. */
  readonly text: string;
  /** Each `#### Amended …` line, as written. */
  readonly amendments: readonly string[];
};

/** What the guard found: one line per violation, and what its pass line counts. */
export type DesignGrade = {
  readonly violations: readonly string[];
  readonly screens: number;
  readonly lockedScreens: number;
  readonly lockedLaws: number;
};

const QUOTED = String.raw`(\d{4}-\d{2}-\d{2}) · @[\w-]+ · "[^"]+"`;
const LOCK_LINE = new RegExp(`^🔒 ${QUOTED}$`);
const LOCK_OWNER = /· (@[\w-]+) ·/;
const LAW_AMENDMENT = /^#### Amended\b/;
const LAW_AMENDMENT_LINE = new RegExp(`^#### Amended ${QUOTED}$`);
const SCREEN_AMENDMENT_LINE = new RegExp(`^> Amended ${QUOTED}: \\S.*$`);
const COMMENT = /<!--[\s\S]*?-->/g;
const STATUS_LINE = /^status:.*$/m;

const SCREEN_AMENDMENT_SHAPE = '"> Amended <YYYY-MM-DD> · @<login> · \\"<their words>\\": <what changed>"';
const LAW_AMENDMENT_SHAPE = '"#### Amended <YYYY-MM-DD> · @<login> · \\"<their words>\\""';

const lines = (text: string) => text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd());

/** The laws of a `language` slot's body: each `### ` heading and what follows it, comments dropped. */
function parseLaws(body: string): Law[] {
  const laws: { heading: string; lines: string[] }[] = [];
  for (const line of lines(body.replace(COMMENT, ''))) {
    const heading = /^### (.+)$/.exec(line)?.[1];
    if (heading !== undefined) laws.push({ heading: heading.trim(), lines: [] });
    else laws.at(-1)?.lines.push(line);
  }
  return laws.map(({ heading, lines: body }) => ({
    heading,
    lock: body.find((line) => line.startsWith('🔒')) ?? null,
    text: body.filter((line) => !LAW_AMENDMENT.test(line)).join('\n').trim(),
    amendments: body.filter((line) => LAW_AMENDMENT.test(line)),
  }));
}

/** The laws of a design form's text; none when it has no `language` slot or does not parse (`omni check kb` grades that). */
function formLaws(text: string | null): Law[] {
  if (text === null) return [];
  const parsed = parseForm(text);
  const slot = parsed.ok ? parsed.form.slots.find((entry) => entry.id === 'language') : undefined;
  return slot ? parseLaws(slot.body.text) : [];
}

/** A screen's text with its amendment lines dropped, and its status line too when `dropStatus`. */
function decidedText(text: string, dropStatus: boolean): string {
  const kept = dropStatus ? text.replace(STATUS_LINE, '') : text;
  return lines(kept).filter((line) => !line.startsWith('> Amended ')).join('\n').trim();
}

/** The lines `added` holds that `before` does not. */
const newLines = (before: readonly string[], after: readonly string[]) => after.filter((line) => !before.includes(line));

/** Grades one decision locked at the base: what it lost, what new amendment does not read, and an unamended change. */
function gradeLocked(
  where: string,
  { owner, changed, before, after, shape, reads }: { owner: string; changed: boolean; before: readonly string[]; after: readonly string[]; shape: string; reads: RegExp },
): string[] {
  const violations: string[] = [];
  if (before.some((line) => !after.includes(line))) violations.push(`${where}: an amendment line was removed — a locked decision keeps every amendment`);
  const added = newLines(before, after);
  for (const line of added.filter((entry) => !reads.test(entry))) violations.push(`${where}: the amendment "${line}" does not read — write it as ${shape}`);
  if (changed && added.length === 0) violations.push(`${where} changed without an amendment — ask ${owner}, who locked it, then add a line ${shape}`);
  return violations;
}

const parsed = (files: Readonly<Record<string, string>>) =>
  Object.entries(files).map(([file, text]) => ({ file, text, read: parseScreen(text, file) }));

function gradeScreens(dir: string, head: DesignSnapshot['screens'], base: DesignSnapshot['screens'] | null): { violations: string[]; screens: Screen[] } {
  const prefix = dir.replace(/\/*$/, '/');
  const now = parsed(head);
  const screens = now.flatMap(({ read }) => (read.ok ? [read.screen] : []));
  const violations = now.flatMap(({ read }) => (read.ok ? [] : [`${prefix}${read.problem}`]));
  for (const old of screens.filter((entry) => entry.status === 'superseded')) {
    if (!screens.some((other) => other !== old && other.supersedes === old.screen)) {
      violations.push(`${prefix}${old.file}: "${old.screen}" is superseded, but no screen names it in supersedes`);
    }
  }
  for (const { file, text, read } of parsed(base ?? {})) {
    if (!read.ok || read.screen.status !== 'locked') continue;
    const was = read.screen;
    const where = `${prefix}${file}: the locked screen "${was.screen}"`;
    const owner = `${was.lockedBy} (locked on ${was.lockedOn})`;
    const nowText = head[file];
    if (nowText === undefined) {
      violations.push(`${where} was removed — ask ${owner}, then mark it superseded and name it in the new screen's supersedes`);
      continue;
    }
    const is = screens.find((entry) => entry.file === file);
    if (is === undefined) continue; // it does not read, and is named above
    const dropStatus = is.status === 'superseded';
    violations.push(
      ...gradeLocked(where, {
        owner,
        changed: decidedText(text, dropStatus) !== decidedText(nowText, dropStatus),
        before: was.amendments,
        after: is.amendments,
        shape: SCREEN_AMENDMENT_SHAPE,
        reads: SCREEN_AMENDMENT_LINE,
      }),
    );
  }
  return { violations, screens };
}

function gradeLaws(formFile: string, head: string | null, base: string | null): { violations: string[]; locked: number } {
  const now = formLaws(head);
  const violations = now.flatMap((law) =>
    law.lock !== null && !LOCK_LINE.test(law.lock)
      ? [`${formFile}: the law "${law.heading}": its lock line "${law.lock}" does not read — write it as "🔒 <YYYY-MM-DD> · @<login> · \\"<their words>\\""`]
      : [],
  );
  for (const was of formLaws(base).filter((law) => law.lock !== null)) {
    const where = `${formFile}: the locked law "${was.heading}"`;
    const owner = LOCK_OWNER.exec(was.lock ?? '')?.[1] ?? 'its owner';
    const is = now.find((law) => law.heading === was.heading);
    if (is === undefined) {
      violations.push(`${where} was removed or renamed — ask ${owner}: a law changes only by a dated amendment below it`);
      continue;
    }
    violations.push(
      ...gradeLocked(where, { owner, changed: was.text !== is.text, before: was.amendments, after: is.amendments, shape: LAW_AMENDMENT_SHAPE, reads: LAW_AMENDMENT_LINE }),
    );
  }
  return { violations, locked: now.filter((law) => law.lock !== null).length };
}

/** Grades the working tree's library and laws, and, when `base` is given, every decision locked there. */
export function gradeDesign({ dir, formFile, head, base }: { dir: string; formFile: string; head: DesignSnapshot; base: DesignSnapshot | null }): DesignGrade {
  const screens = gradeScreens(dir, head.screens, base?.screens ?? null);
  const laws = gradeLaws(formFile, head.form, base?.form ?? null);
  return {
    violations: [...screens.violations, ...laws.violations],
    screens: screens.screens.length,
    lockedScreens: screens.screens.filter((entry) => entry.status === 'locked').length,
    lockedLaws: laws.locked,
  };
}

/** The library and the form as the working tree under `root` holds them. */
export function headSnapshot({ root, dir, formFile }: { root: string; dir: string; formFile: string }): DesignSnapshot {
  const read = (path: string): string | null => (existsSync(path) ? readFileSync(path, 'utf8') : null);
  const folder = join(root, dir);
  let names: string[] = [];
  try {
    names = readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => entry.name);
  } catch {
    names = [];
  }
  const screens: Record<string, string> = {};
  for (const name of names) screens[name] = readFileSync(join(folder, name), 'utf8');
  return { screens, form: read(join(root, formFile)) };
}

/** The library and the form at `ref`, read through git and never checked out. */
export function snapshotAt({ root, ref, dir, formFile, exec }: { root: string; ref: string; dir: string; formFile: string; exec: ExecText }): DesignSnapshot {
  const git = (args: readonly string[]) => exec('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const show = (path: string): string | null => {
    try {
      return git(['show', `${ref}:${path}`]);
    } catch {
      return null;
    }
  };
  const folder = dir.replace(/\/*$/, '/');
  const names = git(['ls-tree', '-z', '--name-only', ref, '--', folder])
    .split('\0')
    .filter((path) => path.endsWith('.md') && path.startsWith(folder) && !path.slice(folder.length).includes('/'));
  const screens: Record<string, string> = {};
  for (const path of names) {
    const text = show(path);
    if (text !== null) screens[path.slice(folder.length)] = text;
  }
  return { screens, form: show(formFile) };
}
