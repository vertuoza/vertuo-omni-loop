// Which pull requests the `omni/approved` check is about (PRD 1612), pure, from the pull request's refs
// and body and its repository's config:
//
// - a **feature PR** into the default branch, its head shaped like `branches.feature`: the PRD whose
//   folder carries its topic (read at the head, as the outbox check reads it), in this repository;
// - a **target PR** into the default branch whose body starts `Part of <owner/repo>#<n>`, naming
//   another repository: PRD n of that repository.
//
// Never a sub-PR (its base is not the default branch) and never a pull request naming no PRD. Whether
// the PRD was born on the server (◆) is read later, from its spec: a ◇ PRD's pull request gets no
// check either.
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Config } from 'omni-loop/kit/lib/types.ts';
import { planPrdOf, pullKind } from '../evaluate/evaluate.ts';

/** What a pull request is to the check: a feature PR of a topic here, a target PR of another
 * repository's PRD, or neither, with why. */
export type Subject =
  | { kind: 'feature'; topic: string }
  | { kind: 'target'; repo: string; prd: PrdNumber }
  | { skip: string };

/** The PRD a target PR's body says it is part of, as the outbox check reads it (`planPrdOf`), only
 * when the body starts with that line; null when it does not, or names `slug`, its own repository. */
export function partOf(body: string, slug: string): { repo: string; prd: PrdNumber } | null {
  return body.trimStart().startsWith('Part of ') ? planPrdOf(body, slug) : null;
}

/** What pull request `pr` of `slug` (owner/name) is to the check. */
export function subjectOf(pr: { baseRef: string; headRef: string; body: string }, config: Config, slug: string): Subject {
  if (pr.baseRef !== config.repo.defaultBranch) return { skip: `The base \`${pr.baseRef}\` is not the default branch.` };
  const target = partOf(pr.body, slug);
  if (target) return { kind: 'target', ...target };
  const kind = pullKind(pr, config);
  if ('skip' in kind) return kind;
  if (kind.kind !== 'feature') return { skip: `A ${kind.kind} pull request names no PRD.` };
  return { kind: 'feature', topic: kind.topic };
}
