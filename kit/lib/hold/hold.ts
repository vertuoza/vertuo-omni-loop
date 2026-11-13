/**
 * **Hold a consumer pull request until its provider is served** (PRD 2746, slice s1).
 *
 * A pull request body may carry `Merge after <owner/repo>#<n>` lines, one per provider pull request
 * the consumer needs merged first (`<owner/repo>` omitted means the consumer's own repository).
 * `omni hold` reads them and the provider's state; this module holds the pure half: the lines read
 * from a body, a row from a provider's state, and the verdict from the rows. A merged provider whose
 * repository declares a probe at `merge-after.served` (s3, `probe.ts`) gives a `probe` row: the agent
 * follows each hook it names before the pull request may be marked ready.
 */
import { z } from 'zod';
import type { Probe, ProbeRead } from './probe.ts';

/** A pull request of a repository: `demo-org/api#41`. */
export type PullRef = { repo: string; number: number };

/** The state `gh pr view --json state,mergedAt,mergeCommit` gives of a provider. */
export const ProviderStateSchema = z.object({
  state: z.enum(['OPEN', 'MERGED', 'CLOSED']),
  mergeCommit: z.object({ oid: z.string() }).nullable().optional(),
});

/** What a provider's reading gave: its state, or why it could not be read. */
export type ProviderRead = { state: z.infer<typeof ProviderStateSchema>['state'] } | { failure: string };

/** What a row says: the provider is still being built, done, done with a probe to follow, abandoned, or could not be read. */
export type RowStatus = 'held' | 'clear' | 'probe' | 'fail' | 'not judged';

/** One provider's row; a `probe` row carries the hooks to follow. */
export type HoldRow = { provider: string; what: string; status: RowStatus; why: string; probes?: Probe[] };

export type Verdict = { kind: RowStatus; line: string };

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

/** The row for a merged provider, from what its probe's reading gave. */
function mergedRow(name: string, probe: ProbeRead): HoldRow {
  if ('failure' in probe) return { provider: name, what: 'merged · probe not read', status: 'not judged', why: probe.failure };
  if (probe.probes.length === 0) return { provider: name, what: 'merged · no probe', status: 'clear', why: 'it is merged' };
  const hooks = probe.probes.map(({ hook }) => hook).join(', ');
  return { provider: name, what: `merged · probe ${hooks}`, status: 'probe', why: `follow ${hooks}`, probes: probe.probes };
}

/** The row for a provider, from what its reading gave, and for a merged one its probe's (none read: merged is enough). */
export function rowOf(provider: PullRef, read: ProviderRead, probe: ProbeRead = { probes: [] }): HoldRow {
  const name = refText(provider);
  if ('failure' in read) {
    return { provider: name, what: `could not read: ${read.failure}`, status: 'not judged', why: `could not read ${name}: ${read.failure}` };
  }
  if (read.state === 'OPEN') return { provider: name, what: 'open', status: 'held', why: 'it is not merged yet' };
  if (read.state === 'MERGED') return mergedRow(name, probe);
  return { provider: name, what: 'closed, not merged', status: 'fail', why: 'it was closed without merging' };
}

/** The row as it prints: provider, what was read, status. */
export function rowLine(row: HoldRow): string {
  return `${row.provider} ${row.what} ${row.status}`;
}

/** The last line and its kind: a `fail`, else a `not judged`, else the first `held`, else every `probe`, else `clear`. */
export function verdictOf(rows: readonly HoldRow[]): Verdict {
  const fail = rows.find((row) => row.status === 'fail');
  if (fail !== undefined) return { kind: 'fail', line: `fail: ${fail.provider} ${fail.why}` };
  const unread = rows.find((row) => row.status === 'not judged');
  if (unread !== undefined) return { kind: 'not judged', line: `not judged: ${unread.why}` };
  const held = rows.find((row) => row.status === 'held');
  if (held !== undefined) return { kind: 'held', line: `held: ${held.provider} ${held.why}` };
  const probes = rows.filter((row) => row.status === 'probe');
  if (probes.length > 0) return { kind: 'probe', line: `probe: ${probes.map((row) => `${row.provider} ${row.why}`).join('; ')}` };
  return { kind: 'clear', line: 'clear' };
}

/** A `clear` verdict lets a pull request be marked ready, and a `probe` one once every probe passes: exit 0. */
export function exitOf(verdict: Verdict): number {
  return verdict.kind === 'clear' || verdict.kind === 'probe' ? 0 : 1;
}
