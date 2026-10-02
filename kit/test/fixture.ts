import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';
import { ConfigSchema } from '../lib/config.ts';
import { createContext } from '../lib/context.ts';
import type { Context } from '../lib/context.ts';

/** A plain object of test values, merged into a config or written as front matter. */
export type Overrides = Record<string, unknown>;

/** One slot of a form file `formText` writes. */
export type SlotFixture = {
  id: string;
  heading?: string;
  required?: boolean;
  by?: string | null;
  verified?: string | null;
  marker?: string | null;
  body?: string;
};

export function deepMerge(base: unknown, over: unknown): unknown {
  if (Array.isArray(over) || over === null || typeof over !== 'object') return over;
  const from = base as Overrides | null | undefined; // ts-allow: spread and read as JavaScript spreads and reads it, whatever it is
  const out: Overrides = { ...from };
  for (const [key, value] of Object.entries(over)) {
    out[key] = from && typeof from[key] === 'object' && from[key] !== null && !Array.isArray(from[key])
      ? deepMerge(from[key], value)
      : value;
  }
  return out;
}

export function testContext(root: string, overrides: Overrides = {}): Context {
  const config = ConfigSchema.parse(deepMerge({ kit: 1, repo: { slug: 'acme/widgets' } }, overrides));
  return createContext(root, config);
}

export function makeRepo({ files = {}, config = {}, git = false }: { files?: Readonly<Record<string, string | undefined>>; config?: Overrides; git?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-'));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  for (const [path, text] of Object.entries(files)) write(path, text as string); // ts-allow: a fixture names only files it writes
  if (git) {
    const run = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    run('init', '-q', '-b', 'main');
    run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'root');
    if (Object.keys(files).length) {
      run('add', '-A');
      run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture');
    }
  }
  return { root, ctx: testContext(root, config), write, read: (path: string) => readFileSync(join(root, path), 'utf8') };
}

/** What `makeRepo` hands a test: the root, its context, and a writer and a reader of its files. */
export type Repo = ReturnType<typeof makeRepo>;

/** A repository's files, path to text. */
export type Files = Record<string, string>;

/** A fake `execFileSync` a test hands a command: it answers what it fakes, and may run the rest. */
export type FakeExec = (file: string, args: readonly string[], options?: ExecFileSyncOptions) => string;

/** The real `execFileSync`, for the calls a fake does not answer: the kit always asks for text. */
export const realExec: FakeExec = (file, args, options) => execFileSync(file, args, options) as string; // ts-allow: the kit runs every process with a text encoding

/** What a fake `fetch` reads of a request: its method, its headers and its body. */
export type FetchInit = { method?: string; headers: Record<string, string>; body?: string; signal?: AbortSignal | null };

/** Where a test's command prints, and what it printed. */
function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

/** What `io()` hands a test. */
export type Io = ReturnType<typeof io>;

/** One slot's `<!-- slot: … -->` marker, fields in the order the parser reads them. */
export function slotMarker({ id, required = false, by = null, verified = null }: SlotFixture): string {
  const fields = [`slot: ${id}`, required ? 'required' : 'optional'];
  if (by) fields.push(`by: ${by}`);
  if (verified) fields.push(`verified: ${verified}`);
  return `<!-- ${fields.join(' · ')} -->`;
}

/**
 * A form file's text, shaped as `kit/lib/playbook/forms.ts` reads it: front matter, the title, the
 * opener, then per slot its `## <heading>`, its marker and its body. A front-matter key set to
 * `undefined` is left out; a slot's `marker` replaces its marker line (`null` drops it).
 */
export function formText({
  frontMatter = {},
  title = 'Testing',
  opener = 'Use this page when adding, changing, or choosing tests.',
  slots = [],
}: { frontMatter?: Overrides; title?: string; opener?: string | null; slots?: readonly SlotFixture[] } = {}): string {
  const fm = { form: 'testing', 'form-version': 1, state: 'blank', 'points-to': null, evidence: [], invaded: null, ...frontMatter };
  const lines = ['---', stringify(fm).trimEnd(), '---', '', `# ${title}`, ''];
  if (opener !== null) lines.push(opener, '');
  for (const slot of slots) {
    const heading = slot.heading ?? slot.id.charAt(0).toUpperCase() + slot.id.slice(1);
    lines.push(`## ${heading}`);
    const marker = slot.marker === undefined ? slotMarker(slot) : slot.marker;
    if (marker !== null) lines.push(marker);
    if (slot.body) lines.push(slot.body);
    lines.push('');
  }
  return lines.join('\n');
}
