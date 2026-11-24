# Plan: Settings pages that open fast

PRD #3219, the spec beside this plan (`spec.md`). The feature branch `feat/settings-fast-loads` goes into
`main` as one feature PR (`Closes #3219`); each slice is a sub-PR from `feat/settings-fast-loads--<slice>`
into the feature branch.

Planned against the code as #3215 (the profiler, `apps/galaxy/src/settings-perf/baseline.json`,
`profile.test.ts`, `budget.md`) and #3218 (the layout `apps/galaxy/app/app/settings/layout.tsx`, pages
inside `SettingsPage`) will leave it, and as it stands today:

- `viewer()` (`src/data/viewer.ts`) is already wrapped in React `cache()`, so the app layout and a page
  already share one client, one claims read and a memoised `workspace()`. What is not shared is the
  **workspace**: every settings loader calls `memberWorkspace(db, user.id)` itself (a fresh
  `workspace_members` read) instead of the viewer's `workspace()`. That read is the first link of every
  page's chain, and it is what the shared read removes.
- Today's chains after the viewer: Fleets, Jev, API keys, Playbook and Repositories read the workspace,
  then their reads together (depth 2, Repositories then waits for GitHub: depth 3); Business reads the
  workspace, `business_open`, seven reads together, then the tokens and the questions: depth 4.
- `src/skeleton/Streamed.tsx` already streams one block behind its own skeleton and shows its notice when
  its read fails, alone. The slow sections use it; no new streaming mechanism is made.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The settings layout reads the signed-in person and the workspace once per request, through a per-request memo a page calls for free, never shared between two requests | `apps/galaxy/src/settings/shared-read*` `apps/galaxy/app/app/settings/layout.tsx` `apps/galaxy/src/settings-perf/baseline.json` `apps/galaxy/src/settings-perf/profile.test.ts` | — | 1 | deep |
| s2 | Fleets, Jev and API keys take the shared workspace and read what is left together; their baseline rows are lowered | `apps/galaxy/src/fleets/load*` `apps/galaxy/app/app/settings/fleets/` `apps/galaxy/src/jev/settings/` `apps/galaxy/app/app/settings/jev/` `apps/galaxy/src/public-api/page/` `apps/galaxy/app/app/settings/api-keys/` `apps/galaxy/src/settings-perf/baseline.json` `apps/galaxy/src/settings-perf/profile.test.ts` | s1 | 2 | build |
| s3 | Repositories and Playbook take the shared workspace, and their slow reads (GitHub access, repository listing) stream behind their own skeleton; their baseline rows are lowered | `apps/galaxy/src/repositories/` `apps/galaxy/app/app/settings/repositories/` `apps/galaxy/src/omni-settings/` `apps/galaxy/app/app/settings/playbook/` `apps/galaxy/src/settings-perf/baseline.json` `apps/galaxy/src/settings-perf/profile.test.ts` | s2 | 3 | build |
| s4 | Business takes the shared workspace, its connect-an-agent tokens and agent questions stream behind their own skeletons, every page meets the budget, and the ratchet and the budget file record what was achieved | `apps/galaxy/src/business/` `apps/galaxy/src/agent-connect/` `apps/galaxy/app/app/settings/business/` `apps/galaxy/src/settings-perf/baseline.json` `apps/galaxy/src/settings-perf/profile.test.ts` `apps/galaxy/src/settings-perf/budget.md` | s3 | 4 | deep |

**Shared ground.** `apps/galaxy/src/settings-perf/baseline.json` and `profile.test.ts` are declared by all
four slices: each page slice lowers its own rows (the ratchet fails an improvement that does not lower
its row, #3215 AC-3), so the file cannot be edited by two slices of one wave. The waves keep them apart:
s2, s3 and s4 are chained one behind the other for that file alone, not because their pages depend on
each other. `apps/galaxy/app/app/settings/layout.tsx` is declared by s1 only (#3218 creates it and has
merged before this plan builds); the pages' `page.tsx` files are each in one slice only. The existing
tests that import what a slice changes (`src/business/render.test.ts`, `constituents-render.test.ts`,
`personas-render.test.ts`, `reveal-render.test.ts` import `BusinessScreen`; the loaders' `load.test.ts`
files) sit inside that slice's own territory. No generated path is listed.

## Per slice: done when

### s1 (deep: a per-request cache is a cross-person leak if it is wrong, L-GDPR-1)

**s1** (`ui: yes`)
- `apps/galaxy/src/settings/shared-read.ts` exposes one read of the signed-in person and the workspace, made
  through the same injectable memo `viewerOf(deps, memo)` uses (React `cache()` in production, a per-call
  fake in a test), and built on `viewer()` and its memoised `workspace()`: no second `viewer()` or
  `workspace_members` read. It returns the demo, closed, sign-in and signed-in kinds `memberSession()`
  returns, plus the workspace for a signed-in person.
- The settings layout calls it once and passes nothing down by props: a page calls the same read
  and gets the same answer for free. (AC-1: a test over fake deps counts one viewer read and one
  membership read for a layout call and a page call of one request.)
- AC-6: a test makes two requests by two different callers (two memo scopes); each read uses its own
  caller's client and user, and the second never returns the first's workspace. The memo is never a
  module-level variable nor `unstable_cache`.
- A workspace read that fails rejects, as the viewer's `workspace()` does, so each loader keeps its own
  `unreadable` notice; the layout still draws its frame (#3218).
- `baseline.json` and `profile.test.ts` stay green; if the profiler counts the layout's read in the root
  row, that row is lowered to the measured value in this slice.

### s2

**s2** (`ui: yes`)
- `loadFleetsPage`, `loadJevPage` and `loadApiKeysPage` (`apiKeysPageReads`) no longer call
  `memberWorkspace`: they take the workspace from the shared read (a parameter, so their tests need no
  database), and the page calls the shared read, not `viewer()` or `memberSession()`.
- Each loader starts the reads that do not depend on each other together (`Promise.all`, as Fleets and Jev
  already do after the workspace); AC-2: a loader test with a fake whose second read starts before the
  first resolves, for each of the three.
- Each page's output for the same data is unchanged (AC-8): the existing screen render tests stay green
  untouched, and a failed read still yields the page's `unreadable` notice, not a thrown page.
- If the profile (#3215) names a slow read on API keys (the usage of its keys), it moves into a `Streamed`
  block with its skeleton; otherwise `budget.md`'s row for it says it has none to stream (s4 writes that).
- Read, never changed: BR-PRODUCT-59 (only the owner sees the stored AI key): the Jev page still reads `keyStatus`
  (stored, last four), never the key, and the owner flag still comes from the owner-only read.
- The Fleets, Jev and API keys rows of `baseline.json` equal the new measured counts, each at most the old
  one, and at most two sequential reads after the shared read; `profile.test.ts` is green.

### s3

**s3** (`ui: yes`)
- `loadRepositoriesPage` and `loadSettingsPage` (Playbook) take the shared workspace instead of calling
  `memberWorkspace`; the pages call the shared read.
- Repositories: the GitHub access read (`accessOf`, the outbound listing of what the App installation
  reaches) moves out of the loader into a `Streamed` block with its own skeleton; the repository rows and
  the owner control are sent first. Playbook: the repository listing (`choice.listed`, read by the service
  after the pages) streams the same way; the pages' text is sent first.
- AC-4 for these two pages: a test whose slow read is a promise that has not resolved shows the frame, the
  first section and the skeleton of the pending block. AC-5: a test whose streamed read rejects shows that
  block's notice and the rest of the page intact (`Streamed`'s `failed`).
- Unchanged for the same data (AC-8): content, owner-only controls (row-level security still decides), the
  demo's DEMO views. The App's credentials are read no earlier and logged nowhere new (L-GDPR-2).
- The Repositories and Playbook rows of `baseline.json` equal the measured counts, at most the old ones,
  and the profile shows the frame's reads at most two sequential after the shared read.

### s4 (deep: the widest page, a streamed section that must fail alone)

**s4** (`ui: yes`)
- `loadBusinessPage` takes the shared workspace; `business_open` stays the one read the others wait on (it
  makes the business the first time), so the page's chain is the shared read, `business_open`, then the
  seven reads together: two sequential reads after the shared one.
- `loadTokens` and `loadQuestions` leave the page's await: the Business page renders the claims, the
  products and the personas first, and the connect-an-agent card and the agent questions card each arrive
  behind a `Streamed` block with its own skeleton (AC-4: a test whose two reads never resolve renders the
  frame, the first section and both skeletons). `BusinessScreen`'s `agents` and `questions` props carry the
  streamed blocks (or their reads) instead of resolved data; the demo still renders both filled at once.
- AC-5: a test whose tokens read rejects shows that card's notice while the questions card and the rest of
  the page render; the same with the questions read rejecting.
- Read, never changed: N-PRODUCT-17 (no secret is sent to the browser): a token's secret is never part of the
  streamed block; the cards show what they show today (last four).
- AC-8: the existing Business render tests pass with the same content; the page's permissions and the demo
  are unchanged.
- AC-3: `profile.test.ts` gains the budget check: no page makes more than two sequential reads after the
  shared read. A page still above it, if the profile shows one, is listed in `budget.md` with why and
  the check names it as the one allowed exception, written down rather than skipped.
- AC-7: `baseline.json` equals the measured counts for every page and each number is at most its value
  before this PRD (a test compares it to the counts the profile reported at the PRD's start, kept in
  `budget.md`). `budget.md` records what was achieved per page and the pages still above the budget, with why.
- Everything below the frame of a page still renders when its streamed neighbour fails, and every
  page shows the same content for the same data as before the PRD.
