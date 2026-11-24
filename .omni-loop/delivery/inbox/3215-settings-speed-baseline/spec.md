---
prd: 3215
title: Measure where the settings pages lose their time
blocked-by: none
spec: file
phase0: server
---

## Problem

The mission's owner reports that Settings is slow. Nobody can say which page, or which part of it, because nothing measures it. What the code shows:

- Every settings page is drawn inside `app/app/layout.tsx`, which reads the viewer once per request (`viewerLive`), and then each page reads the signed-in person again (`viewer()` or `memberSession()`) before its own loader.
- Business is the widest: `loadBusinessPage`, then `loadTokens` and `loadQuestions` together, all before a byte of the page is sent. Fleets, Repositories, API keys, Jev and Playbook each have their own loader, none shared.
- The skeletons (`loading.tsx`) hide the wait but do not shorten it, and no test would notice if a page grew a fourth sequential read.

A speed fix with no baseline is a guess. This PRD gives the team the numbers first.

## Solution

### 1. A counted read profile per settings page

`apps/galaxy/src/settings-perf/` holds a profiler that renders each settings route in test, over the same fakes the pages' tests use, and records, per page: how many reads it makes (database calls, rpc calls, outbound fetches), how many of them are **sequential** (the depth of the longest chain), and which loader made each. Round trips are counted, not milliseconds, so the result is the same on every machine and the check never flakes.

### 2. A baseline and a ratchet

`settings-perf/baseline.json` records today's counts for the settings root, Fleets, Repositories, Business, API keys, Jev and Playbook. A test fails when a page's reads or depth **grow** past the baseline, and when the baseline is not the measured value (so an improvement must lower it, as the design baseline does). Later PRDs of this roadmap lower it; none may raise it.

### 3. The real clock, read from a deployment

A request to a settings page carries a `Server-Timing` entry per phase (`shell`, `data`, `render`) so a person can read where the time went in the browser's network panel on a preview. How the phases are measured is settled at planning against what Next allows; the committed outcome is the entries, not the mechanism.

### 4. The budget, written down

`settings-perf/budget.md` states the target the roadmap builds toward (Q5: no settings page makes more than two sequential reads after the one read shared by the whole of Settings, and the page's frame is usable before any slow read finishes) and names, from the profile, which pages miss it today and why. It is the brief for the fast-loads PRD.

## Conventions

No name chosen.

## Decisions

- **Q5 — recommended default, accepted when this PRD is approved:** No page makes more than two sequential reads after the one read shared by Settings, and its frame is usable before any slow read finishes.
- **Counts, not milliseconds, are the ratchet.** A millisecond budget is flaky in CI and says nothing about why; a count of sequential reads is exact and points at the line to change. The milliseconds are read, not gated, from `Server-Timing` on a preview.

## User stories

- As a member who opens Settings, I want the team to know which page is slow and why, so the fix goes to the right page.
- As a developer of the settings, I want a failing test the day a page grows a new sequential read, so Settings does not slow down again unnoticed.

## Scope

In: the profiler, the baseline and its ratchet test, the `Server-Timing` entries on settings routes, `budget.md`.

Out: any change to what a page reads or how fast it opens (the fast-loads PRD); any change to a screen; the product-level settings pages (Q4).

## Test seams

- `apps/galaxy/src/settings-perf/profile.test.ts`, over the pages' existing fakes: each settings route's counted reads and depth equal the baseline; a page given an extra sequential read fails the ratchet; a lower measured value than the baseline fails until the baseline is lowered.
- A test that every route under `app/app/settings/` has a baseline row, so a new page cannot skip the ratchet.
- No test calls the real Supabase, GitHub or the network.

## Risks

- **What merging publishes:** a new test and a baseline file, and a `Server-Timing` response header on settings pages (phase names and durations only, no data). Rolled back by reverting the pull request; no migration, no stored shape.
- **A leak through the header.** It names phases and durations, never a workspace, a person or a query.
- **The Legal entries:** L-GDPR-1 and L-GDPR-2 are not touched: the header holds no personal data and no credential.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: Every settings page has a profile row
  Given the settings routes under app/app/settings
  When the profiler renders each of them over the page fakes
  Then baseline.json holds a row for the root, Fleets, Repositories, Business, API keys, Jev and Playbook, each with its reads, its sequential depth and the loader of each read
```

### AC-2 · test

```gherkin
Scenario: A page that grows a sequential read fails
  Given a page whose loader gains one more awaited read after another
  When the ratchet test runs
  Then it fails and names the page and the new depth
```

### AC-3 · test

```gherkin
Scenario: An improvement must lower the baseline
  Given a page that now makes fewer reads than its baseline row
  When the ratchet test runs
  Then it fails until the baseline row is lowered to the measured value
```

### AC-4 · test

```gherkin
Scenario: A route with no row fails
  Given a new directory under app/app/settings with a page
  When the coverage test runs
  Then it fails and names the route that has no baseline row
```

### AC-5 · test

```gherkin
Scenario: A settings response says where its time went
  Given a request to a settings page
  When the response is built
  Then its Server-Timing header holds shell, data and render entries and no other field of the request
```

### AC-6 · test

```gherkin
Scenario: The budget names what to fix
  Given the profile of every settings page
  When budget.md is read
  Then it states the Q5 budget and lists each page that misses it with the loader that causes it
```
