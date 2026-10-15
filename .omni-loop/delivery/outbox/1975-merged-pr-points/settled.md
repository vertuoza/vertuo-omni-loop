# Settled outbox items — PRD 1975

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-beyond-territory -->

## s1-01-beyond-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-beyond-territory
prd: 1975
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Paying merged pull requests needed three small changes in files this slice's plan did not list. Is that acceptable, or should those changes wait for a later slice?

## The decision, in plain words

The three changes were made in this slice, each as small as it could be, so the new points work and the galaxy view keeps loading once they are written.

## The intro, for fun

The map said stay in the yard, but the gate had a loose hinge.

## The punchline, for fun

Three screws tightened, nothing else touched.

## The options, in plain words

A. A. Keep the three changes in this slice, so the arcade keeps loading once a merged pull request's points are written.
B. B. Undo them here and let the last slice carry them, accepting that the arcade fails to load in between.

## What I had to decide

Keep the three changes in this slice (A), or undo them and let a later slice carry them (B).

## What I did meanwhile

The slice ships with the three changes in it.

## What it costs to change later

Undoing them is a small revert: the shared shape of a read, one filter line in the galaxy view, and one database check file. No stored data depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The database check runs only in the repository's continuous integration, not on this machine: it was not run here. (author)
- The three files outside the territory: game/types.ts (the snapshot names the merged pull requests), packages/galaxy/src/galaxy.ts (planet 0 left out of the map; it threw on a PRD number 0 without it) and supabase/checks/game_answered_rounds.sql (the ledger takes PR_MERGED and PR_REVIEWED on planet 0). (author)

```

<!-- /omni-outbox-settled: s1-01-beyond-territory -->

<!-- omni-outbox-settled: s2-01-beyond-territory-fixtures -->

## s2-01-beyond-territory-fixtures — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-beyond-territory-fixtures
prd: 1975
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

Making secured zones pay nothing broke tests in files this slice's plan did not list, because they used a secured zone as their example of earning points, and the demo world's ranking lost its shape. Is it acceptable that this slice fixed them?

## The decision, in plain words

Those tests now earn their points another way (a rescue, a closed question, or a merged or reviewed pull request), their checks unchanged otherwise, and the demo world gained one merged pull request so its ranking still shows the player in the middle of the board.

## The intro, for fun

The zone stopped paying, and every test that counted on it came up short.

## The punchline, for fun

They found other work, and the scoreboard still adds up.

## The options, in plain words

A. Keep the fixes in this slice, so every test passes with the new pay.
B. Undo them here and let the last slice carry them, accepting a red test run in between.

## What I had to decide

Keep these fixes in this slice (A), or undo them and let the last slice carry them (B).

## What I did meanwhile

The slice ships with the fixes in it, and the whole test run is green.

## What it costs to change later

Undoing them is a small revert of test examples and one demo pull request; no stored data depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Files outside the territory: game/experience.test.ts, game/cli/score.test.ts, game/sources/github.test.ts, apps/galaxy/src/dashboard/load.test.ts, apps/galaxy/src/dashboard/season.test.ts, apps/galaxy/src/data/load-galaxy.test.ts, packages/galaxy/src/galaxy.test.ts, packages/galaxy/src/xp.test.ts and packages/galaxy/src/demo.ts (one merged feat pull request, so the demo's rankings test still finds the player below the top five).
- (author) The score function now takes an optional rulebook, the real one by default, so the night shift, the revert and the clawback stay tested under the rollback's numbers.

```

<!-- /omni-outbox-settled: s2-01-beyond-territory-fixtures -->

<!-- omni-outbox-settled: s3-01-levels-leave-out-zero-pay -->

## s3-01-levels-leave-out-zero-pay — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-levels-leave-out-zero-pay
prd: 1975
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

The arcade's how-to-play page still listed the secured zone and the old feature merge among what earns experience, though they now pay nothing. Should that list leave them out and name the two new pull request credits instead?

## The decision, in plain words

The list now names the merged and the reviewed pull request, and leaves out the three credits that pay no point any more, so the page no longer names a secured zone and fits its screen again.

## The intro, for fun

The experience list still advertised a job that stopped paying.

## The punchline, for fun

We took the old posters down and pinned up the new ones.

## The options, in plain words

A. A. The list names only the credits that pay points: the merged and the reviewed pull request in, the secured zone and the old feature merge and approval out.
B. B. Keep every credit on the list, the three that pay nothing included, and accept that the page names a secured zone and runs off the screen.
C. C. Keep A, with other words for the two new lines.

## What I had to decide

Agree that the experience list names only the credits that pay points (A), keep every credit on it (B), or reword the two new lines (C).

## What I did meanwhile

The list names the merged and the reviewed pull request and leaves out the secured zone and the old feature merge and approval.

## What it costs to change later

Putting the three lines back, or renaming the two new ones, is a one-line change to the arcade's page and its test; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the briefing's EARN words but says nothing of its LEVELS list; it asks that the briefing no longer name a secured zone, which the list did.
- (author) The two new lines read PR MERGED and PR REVIEWED, in the list's own short style; no one chose those words.
- (author) The arcade could not be walked past its sign-in here, so the briefing was checked from its own markup with the arcade's styles, outside the app. There the tall screen's experience page still runs past its bottom edge, by less than before this change; that overrun was there before this pull request.
- (author) The briefing's note grew to 13 words, the words the spec gives, past the word check's 7-word mark for text at rest; left as the spec wrote it.
- (author) The feed names a person as @login, as every other feed line does, where the plan wrote the login alone.

```

<!-- /omni-outbox-settled: s3-01-levels-leave-out-zero-pay -->

<!-- omni-outbox-settled: s1-02-rule-tests-gain-cases -->

## s1-02-rule-tests-gain-cases — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-15T10:36:24Z
- Channel: feature pull request #1976
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1976#issuecomment-6190088340
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-78
- Raised: 2026-10-15
- Slice: s1
- Wave: 1
- Stays here: the four rules stand as written; their tests only gained cases beside the existing ones, so there is nothing new to write down.

### The answer, as it was given

```text
A. A. The rules stand as written: their checks are unchanged and only new cases sit beside them.
```

### The item, as it was raised

```text
---
id: s1-02-rule-tests-gain-cases
prd: 1975
slice: s1
rank: high
bears-on: BR-PRODUCT-78
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The tests that prove four product rules about answer points, login spelling and the arcade menu gained new cases for merged pull requests, and the spot reserved for answers that belong to no PRD now also holds merged pull request points. Do those rules still read right?

## The decision, in plain words

Every existing check of those rules was kept as it was; only new cases were added beside them, and the reserved spot was widened to the two new kinds of points, which the map still leaves out.

## The intro, for fun

Four rules found new neighbours moving in next door.

## The punchline, for fun

Nobody touched their furniture.

## The options, in plain words

A. A. The rules stand as written: their checks are unchanged and only new cases sit beside them.
B. B. Reword the answer rule to say that merged pull request points share the spot reserved for answers no PRD claims.

## What I had to decide

Agree that the rules stand as written (A), or ask for the answer rule to say that merged pull request points share that spot (B).

## What I did meanwhile

The rules stay as written, and their tests prove them as before.

## What it costs to change later

Rewording the rule later is a one-line change to the rules register; the points and the tests stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Files: game/rulebook.test.ts, game/projector.test.ts and game/economy.test.ts (BR-PRODUCT-77, BR-PRODUCT-79), apps/galaxy/src/arcade/scenes/menu.test.ts (BR-PRODUCT-48, only the XP weights list), supabase/checks/game_answered_rounds.sql and the new migration's planet check (BR-PRODUCT-78). (author)
- The database check runs only in continuous integration; it was not run on this machine. (author)

```

<!-- /omni-outbox-settled: s1-02-rule-tests-gain-cases -->

<!-- omni-outbox-settled: s2-02-sub-pr-rule-written -->

## s2-02-sub-pr-rule-written — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-15T10:36:24Z
- Channel: feature pull request #1976
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1976#issuecomment-6190088340
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-112
- Raised: 2026-10-15
- Slice: s2
- Wave: 2
- Became: BR-PRODUCT-112

### The answer, as it was given

```text
A. The rule stands as written, with the expedition bonus as its one exception.
```

### The item, as it was raised

```text
---
id: s2-02-sub-pr-rule-written
prd: 1975
slice: s2
rank: high
bears-on: BR-PRODUCT-112
raised: 2026-10-15
wave: 2
---

## The question, in plain words

A new product rule now says that a sub-PR never earns points, with one exception: the expedition bonus its author still earns when the planet terraforms. Does the rule read right, as written?

## The decision, in plain words

The rule was added to the product rules as the PRD asked, in plain words, naming the test that proves it. It is not locked as a law: every law slot is full, and locking it is for its owner.

## The intro, for fun

Sub-PRs used to bring home a little pocket money.

## The punchline, for fun

Now they work for the glory, and a ride on the expedition.

## The options, in plain words

A. The rule stands as written, with the expedition bonus as its one exception.
B. Reword the rule, keeping what it allows and refuses.

## What I had to decide

Agree with the rule as written (A), or reword it (B).

## What I did meanwhile

The rule stands as written, and the score test proves it.

## What it costs to change later

Rewording the rule later is a one-line change to the rules register; the points and the test stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The rule's Decided line names the PRD's approver, who chose the rework in the spec; the entry has no Merged line until the feature pull request merges.

```

<!-- /omni-outbox-settled: s2-02-sub-pr-rule-written -->
