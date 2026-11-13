/**
 * **Hold a consumer pull request until its provider is served** (PRD 2746, slice s1).
 *
 * A pull request body may carry `Merge after <owner/repo>#<n>` lines, one per provider pull request
 * the consumer needs merged first (`<owner/repo>` omitted means the consumer's own repository).
 * `omni hold` reads them and the provider's state; this module holds the pure half: the lines read
 * from a body, a row from a provider's state, and the verdict from the rows.
 */
import { z } from 'zod';

/** A pull request of a repository: `demo-org/api#41`. */
export type PullRef = { repo: string; number: number };

/** The state `gh pr view --json state,mergedAt,mergeCommit` gives of a provider. */
export const ProviderStateSchema = z.object({ state: z.enum(['OPEN', 'MERGED', 'CLOSED']) });

/** What a provider's reading gave: its state, or why it could not be read. */
export type ProviderRead = { state: z.infer<typeof ProviderStateSchema>['state'] } | { failure: string };

/** What a row says: the provider is still being built, done, abandoned, or could not be read. */
export type RowStatus = 'held' | 'clear' | 'fail' | 'not judged';

export type HoldRow = { provider: string; what: string; status: RowStatus; why: string };

export type Verdict = { kind: 'clear' | 'held' | 'fail' | 'not judged'; line: string };

const LINE = /^[ \t]*(?:[-*][ \t]+)?Merge after[ \t]+([\w.-]+\/[\w.-]+)?#(\d+)[ \t]*$/gim;

/** The text of a pull request reference: `demo-org/api#41`. */
export function refText({ repo, number }: PullRef): string {
  return `${repo}#${number}`;
}

/** Reads `<owner/repo>#<n>` (the repository required), or `null`. */
export function parsePullRef(text: string): PullRef | null {
  const match = /^([\w.-]+\/[\w.-]+)#(\d+)$/.exec(text);
  return match === null ? null : { repo: match[1] ?? '', number: Number(match[2]) };
}

/** Every provider a body names, in the body's order, each once; a line with no repository is `own`'s. */
export function mergeAfterLines(body: string, own: string): PullRef[] {
  const found: PullRef[] = [];
  for (const match of body.matchAll(LINE)) {
    const ref = { repo: match[1] ?? own, number: Number(match[2]) };
    if (!found.some((seen) => refText(seen) === refText(ref))) found.push(ref);
  }
  return found;
}

/** The row for a provider, from what its reading gave. */
export function rowOf(provider: PullRef, read: ProviderRead): HoldRow {
  const name = refText(provider);
  if ('failure' in read) {
    return { provider: name, what: `could not read: ${read.failure}`, status: 'not judged', why: `could not read ${name}: ${read.failure}` };
  }
  if (read.state === 'OPEN') return { provider: name, what: 'open', status: 'held', why: 'it is not merged yet' };
  if (read.state === 'MERGED') return { provider: name, what: 'merged · no probe', status: 'clear', why: 'it is merged' };
  return { provider: name, what: 'closed, not merged', status: 'fail', why: 'it was closed without merging' };
}

/** The row as it prints: provider, what was read, status. */
export function rowLine(row: HoldRow): string {
  return `${row.provider} ${row.what} ${row.status}`;
}

/** The last line and its kind: a `fail`, else a `not judged`, else the first `held`, else `clear`. */
export function verdictOf(rows: readonly HoldRow[]): Verdict {
  const fail = rows.find((row) => row.status === 'fail');
  if (fail !== undefined) return { kind: 'fail', line: `fail: ${fail.provider} ${fail.why}` };
  const unread = rows.find((row) => row.status === 'not judged');
  if (unread !== undefined) return { kind: 'not judged', line: `not judged: ${unread.why}` };
  const held = rows.find((row) => row.status === 'held');
  if (held !== undefined) return { kind: 'held', line: `held: ${held.provider} ${held.why}` };
  return { kind: 'clear', line: 'clear' };
}

/** Only a `clear` verdict lets a pull request be marked ready. */
export function exitOf(verdict: Verdict): number {
  return verdict.kind === 'clear' ? 0 : 1;
}
