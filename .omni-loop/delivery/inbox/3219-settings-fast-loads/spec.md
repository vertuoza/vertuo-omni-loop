---
prd: 3219
title: Settings pages that open fast
blocked-by: [3215, 3218]
spec: file
phase0: server
---

## Problem

Settings is slow because every page waits for every read before it sends anything. The baseline PRD (#3215) names the exact reads and the shell PRD (#3218) gives Settings the one layout where shared work can live. Today: the viewer is read in the app layout and again in each page; a page's loaders run one after another where they do not depend on each other; the widest page (Business) waits for tokens and agent questions it shows far below the fold.

## Solution

### 1. One shared read

The settings layout reads the signed-in person and the workspace once and hands them to the page (through a cached, per-request read, so a page's own call is free). A page no longer reads the viewer or the membership itself.

### 2. Reads in parallel, not in a queue

Each page's loaders that do not depend on each other run together (`Promise.all`); the profile's **sequential depth** for every page drops to the budget (Q5: at most two after the shared read).

### 3. The slow parts stream

What a person does not need to start (Business's connect-an-agent tokens and agent questions, the Playbook's repository listing, the API keys' usage) moves inside a `Suspense` boundary with its own skeleton, so the page is usable before they arrive. The frame and the first section are sent at once.

### 4. The ratchet tightens

`settings-perf/baseline.json` is lowered to the new measured counts for each page; the budget file records what was achieved and the pages still above it, if any, with why.

### 5. No behaviour is traded for speed

Each page shows the same content, the same permissions (row-level security decides what a read returns), and the same demo behaviour. A read that fails still shows its page's notice for that section rather than failing the page.

## Conventions

No name chosen.

## Decisions

- **Q5 — recommended default, accepted when this PRD is approved:** No page makes more than two sequential reads after the one read shared by Settings, and its frame is usable before any slow read finishes.
- **Cache per request, never across people**: the shared read is memoised for one request only, so one member's data cannot be served to another (L-GDPR-1).
- **A failed streamed section fails alone**: its own notice, the rest of the page works.

## User stories

- As a member, a settings page shows its frame and first section immediately, and the rest follows.
- As a developer, a page that grows a slow read fails a test.

## Scope

In: the shared read in the settings layout, parallelising each page's loaders, streaming the slow sections, lowering the baseline.

Out: database schema or index changes (a finding that needs one becomes its own PRD through the outbox); a cache that outlives a request; the product-level settings; any visual change beyond the skeletons of streamed sections.

## Test seams

- `apps/galaxy/src/settings-perf/profile.test.ts`: each page's reads and sequential depth equal the new, lower baseline, and none exceeds the budget.
- Each page's loader tests: the loaders run concurrently (a fake whose second read starts before the first resolves), and the page's output is unchanged from today's for the same data.
- A test that a page's streamed section failing shows its notice and the rest of the page still renders.
- A test that the shared read is made once per request and not shared between two requests.
- No real Supabase or network.

## Risks

- **What merging publishes:** faster settings pages; streamed sections; no new data is read or shown. Rolled back by reverting the pull request.
- **Cross-person leak through a cache.** The shared read is per request only, under the caller's own sign-in, so row-level security decides each read. A test holds this.
- **The Legal entries:** L-GDPR-1 (only members read a workspace's data): unchanged, every read stays under the caller's sign-in. L-GDPR-2: no credential is read earlier or logged.
- **The locked laws:** none touched.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The viewer is read once per request
  Given a settings page request
  When the page and its layout render
  Then the viewer and membership are each read once, shared by the layout and the page
```

### AC-2 · test

```gherkin
Scenario: Independent reads run together
  Given a page whose loaders do not depend on each other
  When the page loads
  Then the loaders start together, not one after the other
```

### AC-3 · test

```gherkin
Scenario: Every page meets the budget
  Given the profile of each settings page
  When the profile test runs
  Then no page makes more than two sequential reads after the shared read
```

### AC-4 · test

```gherkin
Scenario: Slow sections stream
  Given the Business page with slow connect-an-agent and question reads
  When the page is requested
  Then the frame and first section are sent before those reads finish, each with its own skeleton
```

### AC-5 · test

```gherkin
Scenario: A failed streamed section fails alone
  Given a streamed section whose read fails
  When the page renders
  Then that section shows its notice and the rest of the page is intact
```

### AC-6 · test

```gherkin
Scenario: The cache never crosses people
  Given two requests by two different members
  When both pages load
  Then each read uses its own caller and neither sees the other's data
```

### AC-7 · test

```gherkin
Scenario: The ratchet is lowered
  Given the new measured counts
  When the baseline is compared
  Then baseline.json equals the measured counts and every number is lower than or equal to the old one
```

### AC-8 · test

```gherkin
Scenario: Content is unchanged
  Given a page's data
  When it is rendered before and after this change
  Then the same content, permissions and demo behaviour appear
```
