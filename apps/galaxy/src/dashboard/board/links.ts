import { historyAddress } from '../../dossier/page/history';
import type { StageId } from '../../stages/stage';
import type { Period } from './period';
import type { Scope } from './tally';

// The board's links (PRD 572): the period switch, and any other link a page draws on the board (the
// fleet picker's), keep the rest of the query, so switching the period keeps the fleet and picking a
// fleet keeps the period. PRD 587: each count of the PRDs tile opens /prd filtered to its stage and to
// the scope as near as /prd can: Mine for you, All for a fleet and the workspace (/prd has no fleet filter).

export type Query = Record<string, string | string[] | undefined>;

/** `path` with the query, one value changed (or removed, with null); the rest kept, in order. */
export function hrefWith(path: string, query: Query, change: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key in change || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  for (const [key, value] of Object.entries(change)) if (value !== null) params.set(key, value);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export const periodHref = (path: string, query: Query, period: Period) => hrefWith(path, query, { period });

/** Where a stage's count opens: /prd at that stage, Mine for you, All otherwise. */
export const stageHref = (scope: Scope, stage: StageId) => historyAddress({ who: scope.kind === 'you' ? 'mine' : 'all', stage });
