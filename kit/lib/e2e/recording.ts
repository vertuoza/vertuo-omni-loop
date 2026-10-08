// PRD 1233: the e2e framework's recordings (`<e2e.dir>/.e2e/cache/*.json`, schema `trace-1`) and the
// tests tagged `prd-<n>`, as `omni e2e status` reads them. Reads files only: no network, no browser,
// no model.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { PrdNumber } from '../ids.ts';

/** The only recording schema the kit reads. */
const SCHEMA_VERSION = 'trace-1';

/** One recorded action of a step: what was done (`name`) and to what (`target`). */
export type Action = { readonly name: string; readonly target: string };

/** One recording file: a step of a test, found again by its test and its call index, never by file name. */
export type Recording = {
  readonly file: string;
  readonly testId: string;
  readonly callIndex: number;
  /** The digest of the step's instruction: two steps of one test can share a call index, never a digest. */
  readonly instruction: string;
  readonly summary: string;
  readonly actions: readonly Action[];
};

/** A recording that cannot be read: its message names the file. */
export class RecordingError extends Error {
  constructor(file: string, why: string) {
    super(`${file}: ${why}`);
    this.name = 'RecordingError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A recording from its file's text; throws a `RecordingError` naming `file` when it is not a `trace-1` one. */
export function parseRecording(file: string, text: string): Recording {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new RecordingError(file, 'not valid JSON');
  }
  if (!isRecord(json)) throw new RecordingError(file, 'not a JSON object');
  if (json['schemaVersion'] !== SCHEMA_VERSION) {
    throw new RecordingError(file, `schemaVersion ${JSON.stringify(json['schemaVersion'])} is not ${SCHEMA_VERSION}`);
  }
  // The framework nests the recording under `payload`; the version sits beside it.
  const { payload } = json;
  if (!isRecord(payload)) throw new RecordingError(file, 'payload is missing');
  const { recordedFor, actions, summary } = payload;
  if (!isRecord(recordedFor) || typeof recordedFor['testId'] !== 'string' || typeof recordedFor['callIndex'] !== 'number') {
    throw new RecordingError(file, 'recordedFor needs a testId and a callIndex');
  }
  if (!Array.isArray(actions)) throw new RecordingError(file, 'actions is not a list');
  return {
    file,
    testId: recordedFor['testId'],
    callIndex: recordedFor['callIndex'],
    instruction: typeof recordedFor['instructionDigest'] === 'string' ? recordedFor['instructionDigest'] : '',
    summary: typeof summary === 'string' ? summary : '',
    actions: actions.map((action: unknown) => {
      const item = isRecord(action) ? action : {};
      const text = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
      // A target is a string, or an object ({ role, name, within }): then the action's own summary
      // names it, and its JSON stands in when there is none.
      const target = item['target'];
      const named = isRecord(target) ? text(item['summary']) || JSON.stringify(target) : text(target);
      return { name: text(item['name']), target: named };
    }),
  };
}

/** Every file under `folder` ending in one of `extensions`, recursively, sorted; a missing folder holds none. */
function filesUnder(folder: string, extensions: readonly string[]): string[] {
  let entries;
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.name !== 'node_modules')
    .flatMap((entry) => {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) return filesUnder(path, extensions);
      return extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
    })
    .sort();
}

const posix = (path: string): string => path.split(sep).join('/');

/** The recordings under `<dir>/.e2e/cache`, in file order; throws a `RecordingError` for the first that does not read. */
export function readRecordings(root: string, dir: string): Recording[] {
  return filesUnder(join(root, dir, '.e2e', 'cache'), ['.json']).map((path) => {
    const name = posix(relative(root, path));
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      throw new RecordingError(name, 'cannot be read');
    }
    return parseRecording(name, text);
  });
}

/** A test file tagged `prd-<n>`: its id is its path under the e2e folder. */
export type TaggedTest = { readonly id: string; readonly file: string };

/** The test files under `<dir>` that carry the tag `prd-<n>` (not `prd-<n>0`), in path order. */
export function readTaggedTests(root: string, dir: string, prd: PrdNumber): TaggedTest[] {
  const tag = new RegExp(`(?<![\\w-])prd-${prd}(?![\\w-])`);
  const base = join(root, dir);
  return filesUnder(base, ['.ts', '.tsx', '.js', '.mjs', '.cjs'])
    .filter((path) => !relative(base, path).split(sep).includes('.e2e'))
    .filter((path) => tag.test(readFileSync(path, 'utf8')))
    .map((path) => ({ id: posix(relative(base, path)), file: posix(relative(root, path)) }));
}
