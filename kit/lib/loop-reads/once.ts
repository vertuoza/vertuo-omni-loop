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

/** `reads`, each distinct read sent once while the result lives; a failed read is sent again when asked again. */
export function readOnce(reads: LoopReads): LoopReads {
  const kept = new Map<string, Promise<unknown>>();
  const once = <T>(name: string, args: readonly unknown[], read: () => Promise<T>): Promise<T> => {
    const key = keyOf(name, args);
    const known = kept.get(key);
    if (known !== undefined) return known as Promise<T>;
    const answer = read();
    kept.set(key, answer);
    answer.catch(() => kept.delete(key));
    return answer;
  };
  return {
    changes: (query) => once('changes', [query], () => reads.changes(query)),
    change: (repo, number) => once('change', [repo, number], () => reads.change(repo, number)),
    comments: (repo, on) => once('comments', [repo, on], () => reads.comments(repo, on)),
    issues: (query) => once('issues', [query], () => reads.issues(query)),
    issue: (repo, number) => once('issue', [repo, number], () => reads.issue(repo, number)),
  };
}
