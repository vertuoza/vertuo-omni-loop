// Where a directory writes its conventions down (PRD 2049): an index of files, never their content.
// It reads files only (no git, no process, no network, no omni config), so it runs on a read-only
// clone. Found in order: `CLAUDE.md` and `AGENTS.md` with the files they import through `@<path>`;
// the files `.omni-loop/config.yml` lists under `paths.context`, when there is one; the readme of
// the docs folder; the readme of its adr folder, else every ADR there; then every Markdown page those link to,
// one level only, inside the directory. Each file is listed once, in the order it was first found.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';
import { propertyOf } from '../narrow.ts';

/** One file of the index: its path from the root, its title, what led to it, and whether it is not there. */
export type ConventionEntry = { path: string; title: string; from: string; missing: boolean };

const READMES = ['readme.md', 'index.md'];
/** The docs folder and its ADR folder, the same names in every repository read (PRD 2049). */
const DOCS = 'docs';
const ADR = 'adr';
const DOCS_FROM = `${DOCS}/`;
const ADR_FROM = `${DOCS}/${ADR}/`;

/** The path of `file` from `root`, with `/` whatever the platform. */
function posix(root: string, file: string): string {
  return relative(root, file).split(sep).join('/');
}

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function readText(file: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** The names in `dir`, or none when it cannot be read. */
function listing(dir: string): string[] {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
}

/** The first of `names` in `dir`, matched without regard to case: the file as it is spelled there, or null. */
function findFile(dir: string, names: readonly string[]): string | null {
  const present = listing(dir);
  for (const name of names) {
    const hit = present.find((candidate) => candidate.toLowerCase() === name && isFile(join(dir, candidate)));
    if (hit !== undefined) return join(dir, hit);
  }
  return null;
}

/** The lines of a Markdown file outside its fenced code blocks. */
function proseLines(text: string): string[] {
  const kept: string[] = [];
  let fence: string | null = null;
  for (const line of text.split('\n')) {
    const mark = /^\s*(```+|~~~+)/.exec(line);
    if (mark) {
      const opener = (mark[1] ?? '').slice(0, 3);
      if (fence === null) fence = opener;
      else if (opener === fence) fence = null;
      continue;
    }
    if (fence === null) kept.push(line);
  }
  return kept;
}

/** The first `#` heading of a Markdown file, or its file name. */
function titleOf(file: string): string {
  for (const line of proseLines(readText(file))) {
    const heading = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading?.[1]) return heading[1];
  }
  return basename(file);
}

function isMarkdown(path: string): boolean {
  return path.toLowerCase().endsWith('.md');
}

/** The relative Markdown links of a file, as written, without anchor, query or title. */
function linksOf(text: string): string[] {
  const found: string[] = [];
  for (const line of proseLines(text)) {
    for (const match of line.matchAll(/\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*["'])?\s*\)/g)) {
      const target = (match[1] ?? '').split('#')[0]?.split('?')[0] ?? '';
      if (target === '' || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue;
      found.push(safeDecode(target));
    }
  }
  return found;
}

function safeDecode(text: string): string {
  try {
    return decodeURI(text);
  } catch {
    return text;
  }
}

/** The Markdown files a file imports with `@<path>` (Claude's syntax), as written, in order. */
function importsOf(text: string): string[] {
  const found: string[] = [];
  for (const line of proseLines(text)) {
    for (const match of line.matchAll(/(?:^|\s)@([^\s`)]+)/g)) {
      const target = match[1] ?? '';
      if (isMarkdown(target)) found.push(target);
    }
  }
  return found;
}

/** `paths.context` of `<root>/.omni-loop/config.yml`, or none when the file is absent or unreadable. */
function contextPaths(root: string): string[] {
  const file = join(root, '.omni-loop', 'config.yml');
  if (!isFile(file)) return [];
  try {
    const listed = propertyOf(propertyOf(parse(readText(file)), 'paths'), 'context');
    return Array.isArray(listed) ? listed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Whether `file` is inside `root`. */
function inside(root: string, file: string): boolean {
  const from = relative(root, file);
  return from !== '' && !from.startsWith('..') && !isAbsolute(from);
}

/** The index being built: each file once, in the order it was first found. */
type Index = {
  base: string;
  entries: ConventionEntry[];
  /** The files that exist, in order: the ones whose links are followed. */
  found: string[];
  seen: Set<string>;
};

/** Lists `file`, led to by `from`; returns whether it was new. */
function add(index: Index, file: string, from: string, missing = false): boolean {
  const path = posix(index.base, file);
  if (index.seen.has(path)) return false;
  index.seen.add(path);
  index.entries.push({ path, title: missing ? basename(file) : titleOf(file), from, missing });
  if (!missing) index.found.push(file);
  return true;
}

/** Lists a root file and, as deep as they go, the files it imports. */
function addWithImports(index: Index, file: string, from: string): void {
  if (!add(index, file, from)) return;
  for (const target of importsOf(readText(file))) {
    const imported = resolve(dirname(file), target);
    if (inside(index.base, imported) && isFile(imported)) addWithImports(index, imported, posix(index.base, file));
  }
}

/** Step 1 and 2: the agent files at the root, then the files `paths.context` lists. */
function addRootFiles(index: Index): void {
  for (const name of ['claude.md', 'agents.md']) {
    const file = findFile(index.base, [name]);
    if (file !== null) addWithImports(index, file, '.');
  }
  for (const listed of contextPaths(index.base)) {
    const file = resolve(index.base, listed);
    if (isMarkdown(listed) && inside(index.base, file)) add(index, file, '.omni-loop/config.yml', !isFile(file));
  }
}

/** Step 3 and 4: the readme of the docs folder, then the readme of its adr folder or each ADR. */
function addDocs(index: Index): void {
  const docs = join(index.base, DOCS);
  const docsReadme = findFile(docs, READMES);
  if (docsReadme !== null) add(index, docsReadme, DOCS_FROM);
  const adr = join(docs, ADR);
  const adrReadme = findFile(adr, READMES);
  if (adrReadme !== null) {
    add(index, adrReadme, ADR_FROM);
    return;
  }
  for (const name of listing(adr)) if (isMarkdown(name) && isFile(join(adr, name))) add(index, join(adr, name), ADR_FROM);
}

/** Step 5: one level of links, from the files found above only. */
function addLinks(index: Index): void {
  for (const file of [...index.found]) {
    for (const target of linksOf(readText(file))) {
      const page = resolve(dirname(file), target);
      if (isMarkdown(target) && inside(index.base, page)) add(index, page, posix(index.base, file), !isFile(page));
    }
  }
}

/** The index of the files where `root` writes its conventions. `root` must be a directory. */
export function readConventions(root: string): ConventionEntry[] {
  const index: Index = { base: resolve(root), entries: [], found: [], seen: new Set() };
  addRootFiles(index);
  addDocs(index);
  addLinks(index);
  return index.entries;
}
