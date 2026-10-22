# Bug 2018: the People table shows 0 PRs for members who merged pull requests

## Triage

- **Domain:** game › contributions (`game/cli/contributions.ts`), read by the workspace board's People table
- **Risk:** medium — every member whose merges land in a tracked repository that is not a sector reads 0 PRs on the workspace board and ranks lower; the Engineering board still counts those merges, so there is a workaround. (Jev, 0.97)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `game/cli/contributions.test.ts`
- **Red:** AssertionError: expected [ { …(6) }, { …(6) }, { …(6) }, …(2) ] to deep equally contain { …(6) }

## Fix

`game:contributions` read only the repositories the workspace's sectors name, so a merge into a
tracked repository no sector names (`demo-org/VertuoBuild`, where Kevin works) never became a
`pr-merged` row, and the People table counted 0 PRs. It now also reads every tracked repository,
each once, under its own owner, as `game:project` has done since PRD 728.

## Guard

The reproduction: a tracked repository no sector names gives its merges a row, an untracked one and
another workspace's are never read.

## Mutation

mutation: no changed core file against origin/main (2cdcf96a): nothing to mutate
