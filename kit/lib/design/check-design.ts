// PRD 1407: `omni check design` — a decision someone locked is not changed without them. A locked
// screen of the library (`design.screens`) or a locked law of the `design` form's `language` slot
// changes only with a new, dated amendment line, its old ones kept; a locked screen is superseded,
// never deleted. Also refused: a screen whose front matter does not read, a `superseded` screen no
// other screen names, and a lock or amendment line that does not read. A draft, and a law with no
// lock line, change freely. The grading is pure, on two snapshots (the working tree, and the base);
// reading the base through git is the one impure part. The kit ships no law and no screen. PRD 1550:
// an `implements` entry that names a folder (it ends in `/` or `/**`) is a warning, never a
// violation: a lock would trip on every file in it, and the code behind a screen belongs in `reads`.
// PRD 1559: DESIGN.md is kept by hand, so it drifts from the code; with design on and a DESIGN.md
// where `design.system` points, four kinds of drift are warnings, never violations: a part whose
// `Code` path is gone, a component file under `design.paths` (its `design.ignore` dropped) that no
// part names and no screen `implements` (a shared screen's shell files included), a token reference
// that does not resolve, and a reference screen the library does not hold.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config.ts';
import type { ExecText } from '../context.ts';
import { parseForm } from '../playbook/forms.ts';
import { matchesGlob } from './glob.ts';
import { designIgnore, dropIgnored } from './ignore.ts';
import { isComponentFile } from './parts/names.ts';
import { parseScreen, type Screen } from './screens.ts';
import { loadDesignSystem } from './system/load.ts';
import type { DesignSystem } from './system/read.ts';

/** PRD 1559: what the drift warnings read from the working tree, beside its DESIGN.md. */
export type DriftFacts = {
  /** Where DESIGN.md was read: what each warning starts with. */
  readonly path: string;
  readonly system: DesignSystem;
  /** The component files under `design.paths`, `design.ignore` dropped. */
  readonly componentFiles: readonly string[];
  /** Each part's `Code` path that names nothing in the working tree. */
  readonly gone: readonly { readonly part: string; readonly path: string }[];
};

/** The screen library and the design form, as one side of the comparison holds them. */
export type DesignSnapshot = {
  /** Each `.md` file directly in the library folder, by file name, as text. */
  readonly screens: Readonly<Record<string, string>>;
  /** The design form's text, or null when it has none. */
  readonly form: string | null;
  /** PRD 1559: the working tree's DESIGN.md and what it describes; absent at the base, and with no DESIGN.md. */
  readonly drift?: DriftFacts | null;
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
  /** PRD 1550: what only reports — one line per `implements` entry that names a folder. */
  readonly warnings: readonly string[];
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

const FOLDER = /\/(?:\*\*)?$/;

/** PRD 1550: one warning per `implements` entry that names a folder, screen by screen. */
function folderWarnings(screens: readonly Pick<Screen, 'screen' | 'implements'>[]): string[] {
  return screens.flatMap(({ screen, implements: paths }) =>
    paths
      .filter((entry) => FOLDER.test(entry))
      .map((entry) => `${screen}: implements names a folder (${entry}) — a lock trips on every file in it; put the code behind the screen in reads`),
  );
}

/** PRD 1559: one warning per drift between DESIGN.md, the code and the library, each led by DESIGN.md's path. */
function driftWarnings(dir: string, drift: DriftFacts, screens: readonly Pick<Screen, 'screen' | 'implements'>[]): string[] {
  const { path, system, componentFiles, gone } = drift;
  const codes = system.parts.flatMap((part) => part.code);
  const claims = screens.flatMap((screen) => screen.implements);
  const claimed = (file: string) => [...codes, ...claims].some((glob) => matchesGlob(glob, file));
  const library = new Set(screens.map((screen) => screen.screen));
  return [
    ...gone.map(({ part, path: code }) => `part ${part}: its code path ${code} is gone`),
    ...componentFiles
      .filter((file) => !claimed(file))
      .map((file) => `${file} is a component file no part names and no screen implements — list it under a part's Code, or in a screen's implements`),
    ...system.unresolved.map(({ reference, where }) => `unresolved reference {${reference}} in ${where}`),
    ...system.referenceScreens
      .filter(({ screen }) => !library.has(screen))
      .map(({ screen }) => `the reference screen "${screen}" is not in the library (${dir.replace(/\/*$/, '/')})`),
  ].map((warning) => `${path}: ${warning}`);
}

/** Grades the working tree's library and laws, and, when `base` is given, every decision locked there. */
export function gradeDesign({ dir, formFile, head, base }: { dir: string; formFile: string; head: DesignSnapshot; base: DesignSnapshot | null }): DesignGrade {
  const screens = gradeScreens(dir, head.screens, base?.screens ?? null);
  const laws = gradeLaws(formFile, head.form, base?.form ?? null);
  return {
    violations: [...screens.violations, ...laws.violations],
    warnings: [...folderWarnings(screens.screens), ...(head.drift ? driftWarnings(dir, head.drift, screens.screens) : [])],
    screens: screens.screens.length,
    lockedScreens: screens.screens.filter((entry) => entry.status === 'locked').length,
    lockedLaws: laws.locked,
  };
}

/** The config's `design` section, as the drift warnings read it. */
export type DriftDesign = {
  readonly enabled: boolean;
  readonly paths: readonly string[];
  readonly ignore?: readonly string[] | undefined;
  readonly system?: string | undefined;
};

const WILDCARD = /[*?{]/;

/** The folder a glob's matches all live under: its segments before the first wildcard. */
const globBase = (glob: string): string => {
  const segments = glob.replace(/^\.\//, '').split('/');
  const cut = segments.findIndex((segment) => WILDCARD.test(segment));
  return (cut === -1 ? segments : segments.slice(0, cut)).filter(Boolean).join('/');
};

/** A folder's entries, or null when `path` is no folder. */
function entriesOf(path: string) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return null;
  }
}

const walked = (name: string) => name !== 'node_modules' && !name.startsWith('.');

/** Every file under `base` (or `base` itself, a file), relative to `root`; `node_modules` and dot folders are never walked. */
function filesUnder(root: string, base: string): string[] {
  const entries = entriesOf(join(root, base));
  if (entries === null) return base && existsSync(join(root, base)) ? [base] : [];
  const at = (name: string) => (base ? `${base}/${name}` : name);
  return entries.flatMap((entry) => {
    if (entry.isDirectory()) return walked(entry.name) ? filesUnder(root, at(entry.name)) : [];
    return entry.isFile() ? [at(entry.name)] : [];
  });
}

/** The files a glob matches in the working tree under `root`. */
const matching = (root: string, glob: string): string[] => filesUnder(root, globBase(glob)).filter((file) => matchesGlob(glob, file));

/** Whether a part's `Code` path names something in the working tree: a file or folder, or a glob's match. */
const present = (root: string, code: string): boolean =>
  WILDCARD.test(code) ? matching(root, code).length > 0 : existsSync(join(root, code.replace(/^\.\//, '').replace(/\/+$/, '')));

/** PRD 1559: the facts the drift warnings grade, or null with design off or no DESIGN.md. */
function driftFacts(root: string, design: DriftDesign | null): DriftFacts | null {
  if (!design?.enabled) return null;
  const { path, system } = loadDesignSystem(root, design);
  if (!system) return null;
  const components = design.paths.flatMap((glob) => matching(root, glob)).filter(isComponentFile);
  return {
    path,
    system,
    componentFiles: dropIgnored(designIgnore(design), [...new Set(components)].sort()),
    gone: system.parts.flatMap((part) => part.code.filter((code) => !present(root, code)).map((code) => ({ part: part.name, path: code }))),
  };
}

/** The config's design section under `root`, or null when it does not read. */
function designOf(root: string): DriftDesign | null {
  try {
    return loadConfig(root).design;
  } catch {
    return null;
  }
}

/**
 * The library and the form as the working tree under `root` holds them, and, PRD 1559, the drift
 * facts of its DESIGN.md; `design` is the config's design section, read from `root` when not given.
 */
export function headSnapshot({ root, dir, formFile, design }: { root: string; dir: string; formFile: string; design?: DriftDesign }): DesignSnapshot {
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
  return { screens, form: read(join(root, formFile)), drift: driftFacts(root, design ?? designOf(root)) };
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
