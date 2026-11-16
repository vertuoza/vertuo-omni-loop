// Issue 2968: within one command run, a `LoopReads` read sends each distinct read once. `omni next`
// asks every PRD it drives for the open phase-0 PRs, the same list each time; the first ask goes to the
// Omni page and every later one, even while the first is still waiting, gets the same answer. A read
// that fails is forgotten, so the next ask of it is sent again, as it was before.
import type { LoopReads } from './port.ts';

/** The text a read is known by: its name, then what it was given, each field in name order, an absent one left out. */
function keyOf(name: string, args: readonly unknown[]): string {
  const fields = args.map((arg) =>
    typeof arg === 'object' && arg !== null
      ? Object.fromEntries(Object.entries(arg).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)))
      : arg,
  );
  return JSON.stringify([name, ...fields]);
}

/** `read`, each distinct ask sent once while its answer lives; a failed one is sent again when asked again. */
function remembered<A extends unknown[], T>(name: string, read: (...args: A) => Promise<T>): (...args: A) => Promise<T> {
  const kept = new Map<string, Promise<T>>();
  return (...args) => {
    const key = keyOf(name, args);
    const known = kept.get(key);
    if (known !== undefined) return known;
    const answer = read(...args);
    kept.set(key, answer);
    answer.catch(() => kept.delete(key));
    return answer;
  };
}

/** `reads`, each distinct read sent once while its answer lives; a failed read is sent again when asked again. */
export function readOnce(reads: LoopReads): LoopReads {
  return {
    changes: remembered('changes', (query: Parameters<LoopReads['changes']>[0]) => reads.changes(query)),
    change: remembered('change', (repo: string, number: Parameters<LoopReads['change']>[1]) => reads.change(repo, number)),
    comments: remembered('comments', (repo: string, on: Parameters<LoopReads['comments']>[1]) => reads.comments(repo, on)),
    issues: remembered('issues', (query: Parameters<LoopReads['issues']>[0]) => reads.issues(query)),
    issue: remembered('issue', (repo: string, number: Parameters<LoopReads['issue']>[1]) => reads.issue(repo, number)),
  };
}
