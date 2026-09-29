# Bug 638: pr-stats exhausts the Omni App's GitHub API budget and blocks the outbox check

## Triage

- **Domain:** omni-app — `apps/omni-app/src/pr-stats/` (the Engineering board's collection, PRD 612), sharing the installation's GitHub budget with the outbox check, retro, knowledge harvest and verdict comment
- **Risk:** high — the outbox check on every Vertuoza PR failed with 403 "API rate limit exceeded for installation ID 164803527" for most of each hour while the 90-day backfill ran; workaround: pause `pr-stats` in Inngest
- **Regression:** yes — #613 (e68ab7e) added `pr-stats`; the outbox check ran green before it, and installation 164803527 hit `x-ratelimit-remaining: 0` of 5700 right after its first run against the database (~12:52 UTC, 2026-09-29)

## Reproduction

- **File:** `apps/omni-app/src/pr-stats/budget.test.mjs`
- **Red:** AssertionError: expected [ …(608) ] to deeply equal [] — collecting 200 pull requests made 608 REST core calls (and the budget test: expected 656 to be greater than or equal to 2500)

## Fix

The collector read every pull request through REST, three core calls each (the pull request, its reviews, its commits), from the same budget the outbox check spends. It now reads through GraphQL only, which has a budget of its own: one paginated `pullRequests(orderBy: UPDATED_AT DESC)` listing per batch and one aliased query for the whole batch's details (author, dates, merger, base, body, sizes, the last 100 commit messages, the first 100 reviews), with GraphQL's bare bot logins mapped back to REST's `name[bot]`. Every query asks for `rateLimit`, and none is sent unless the budget keeps more than half of its limit after it; below that the run ends for every repository of that installation, each cursor at what was written and no error recorded.

## Guard

`apps/omni-app/src/pr-stats/budget.test.mjs`, against a stubbed GitHub with separate REST core and GraphQL budgets: it fails when the collector makes any REST call while collecting 200 pull requests, when it drives either budget below half (600 pull requests from 2520 of 5000), or when it reads with a budget already under half. It fails on main's collector and passes on the fix.

## Mutation

not set here — six hand mutations of the fixed lines (floor 0.5→0.4, margin 10→0, guard check removed, unknown budget refused, rateLimit not recorded, bot login not mapped) were each killed by the pr-stats tests
