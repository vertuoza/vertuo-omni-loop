// PRD 1233: the steps of the e2e recordings at the merge-base and at the head of a feature branch,
// paired by test id and call index (never by file name), as healed, new or removed. Pure except
// `readRecordingsAt`, which reads git objects only: no network, no browser, no model.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { ExecText } from '../context.ts';
import { parseRecording, RecordingError } from './recording.ts';
import type { Action, Recording } from './recording.ts';

/** A step on both sides with different actions: what it did before and what it does now. */
export type Healed = { readonly testId: string; readonly callIndex: number; readonly summary: string; readonly old: readonly Action[]; readonly new: readonly Action[] };
/** A step on one side only. */
export type Step = { readonly testId: string; readonly callIndex: number; readonly summary: string; readonly actions: readonly Action[] };
export type Heals = { readonly healed: Healed[]; readonly new: Step[]; readonly removed: Step[] };

const key = ({ testId, callIndex, instruction }: Recording): string => JSON.stringify([testId, callIndex, instruction]);
const same = (a: readonly Action[], b: readonly Action[]): boolean =>
  a.length === b.length && a.every((action, i) => { const other = b.at(i); return other !== undefined && action.name === other.name && action.target === other.target; });
const step = ({ testId, callIndex, summary, actions }: Recording): Step => ({ testId, callIndex, summary, actions });
const order = (a: { testId: string; callIndex: number }, b: { testId: string; callIndex: number }): number =>
  a.testId < b.testId ? -1 : a.testId > b.testId ? 1 : a.callIndex - b.callIndex;

/** The steps on both sides with different actions, the recording at `base` and the one at `head`. */
export function pairHealed(base: readonly Recording[], head: readonly Recording[]): { before: Recording; after: Recording }[] {
  const before = new Map(base.map((recording) => [key(recording), recording]));
  return head.flatMap((after) => {
    const was = before.get(key(after));
    return was !== undefined && !same(was.actions, after.actions) ? [{ before: was, after }] : [];
  });
}

/** Pairs `base` with `head` by test id and call index; an identical step is not listed. Healed steps carry the head's summary. */
export function compareRecordings(base: readonly Recording[], head: readonly Recording[]): Heals {
  const before = new Map(base.map((recording) => [key(recording), recording]));
  const after = new Map(head.map((recording) => [key(recording), recording]));
  const healed: Healed[] = pairHealed(base, head).map(({ before: was, after: now }) => (
    { testId: now.testId, callIndex: now.callIndex, summary: now.summary, old: was.actions, new: now.actions }
  ));
  const added: Step[] = [...after].filter(([k]) => !before.has(k)).map(([, now]) => step(now));
  const removed = [...before].filter(([k]) => !after.has(k)).map(([, recording]) => step(recording));
  return { healed: healed.sort(order), new: added.sort(order), removed: removed.sort(order) };
}

/** The recordings under `<dir>/.e2e/cache` as committed at `rev`; throws a `RecordingError` naming the first that does not read. */
export function readRecordingsAt({ root, rev, dir, exec }: { root: string; rev: string; dir: string; exec: ExecText }): Recording[] {
  const options: ExecFileSyncOptionsWithStringEncoding = { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] };
  const folder = `${dir.replace(/\/+$/, '')}/.e2e/cache`;
  const listing = exec('git', ['ls-tree', '-r', '--name-only', rev, '--', `${folder}/`], options);
  return listing.split('\n').filter((path) => path.endsWith('.json')).sort().map((path) => {
    let text: string;
    try {
      text = exec('git', ['show', `${rev}:${path}`], options);
    } catch {
      throw new RecordingError(path, 'cannot be read');
    }
    return parseRecording(path, text);
  });
}
