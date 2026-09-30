# Settled outbox items — PRD 748

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-no-page-reads-as-no-sign-in -->

## s1-01-no-page-reads-as-no-sign-in — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-no-page-reads-as-no-sign-in
prd: 748
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When a repository has no Omni page set at all, or its sign-in has expired for good, what should the business read say to an agent?

## The decision, in plain words

Both count as having no sign-in: the agent reads one line saying so and carries on, exactly as when nobody ever signed in.

## The intro, for fun

An agent knocked on a door that was never built.

## The punchline, for fun

It was told nobody is home, and went back to work.

## The options, in plain words

A. Both are no-sign-in, the option built.
B. ask.url unset exits 2 as a configuration error, and a 401 reads as refused.

## What I had to decide

Which of the five read states covers ask.url unset in the config, and a 401 the refresh cannot fix.

## What I did meanwhile

Both answer state no-sign-in with exit 0; a 403, a 404 or another refusal answers refused. ask.url unset is not a configuration error (exit 2), so a skill line calling it never stops.

## What it costs to change later

Two branches in kit/bin/commands/business.mjs and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec lists the states but names neither case (author)

```

<!-- /omni-outbox-settled: s1-01-no-page-reads-as-no-sign-in -->

<!-- omni-outbox-settled: s1-02-last-seen-stays-empty -->

## s1-02-last-seen-stays-empty — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-last-seen-stays-empty
prd: 748
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Each fact an agent reads carries a 'last seen' date, but nothing in this change ever sees a fact anywhere. What should that date say?

## The decision, in plain words

It stays empty for now. It fills in once a later change reads facts from real sources, such as a pricing page.

## The intro, for fun

We built a guest book before anyone came to visit.

## The punchline, for fun

Its pages are blank, and that is honest.

## The options, in plain words

A. Null until evidence sets it, the option built.
B. The date the claim was picked or last confirmed.

## What I had to decide

What claims.last_seen and the contract's lastSeen hold while no evidence sets them.

## What I did meanwhile

The column last_seen is null on every claim, and lastSeen is null in every read; the pick date is kept apart in created_at and updated_at.

## What it costs to change later

One nullable column; filling it later needs no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec names lastSeen in decision 14 without saying what sets it before evidence drafting (author)

```

<!-- /omni-outbox-settled: s1-02-last-seen-stays-empty -->

<!-- omni-outbox-settled: s1-03-help-count-test -->

## s1-03-help-count-test — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-help-count-test
prd: 748
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Adding the new business command meant changing a test that counts every command, and that test sits outside this slice's agreed files. Is that fine?

## The decision, in plain words

We raised the expected number of commands by one in that test, and changed nothing else in it.

## The intro, for fun

A new command walked in and the head count was off by one.

## The punchline, for fun

So we counted again, out loud, and wrote down the new number.

## The options, in plain words

A. Raise the count in the help test to 35, the option built.
B. Leave the count as it is and take the business command out of the command list, which the plan does not allow.

## What I had to decide

Whether kit/lib/help/entries.test.mjs may move its command count from 34 to 35, outside s1's territory.

## What I did meanwhile

The count reads 35 in both of its assertions; the test's other checks are untouched.

## What it costs to change later

Two numbers in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan's territory for s1 lists kit/lib/help/entries.mjs but not its test (author)

```

<!-- /omni-outbox-settled: s1-03-help-count-test -->

<!-- omni-outbox-settled: s2-01-one-offering-one-trade -->

## s2-01-one-offering-one-trade — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-one-offering-one-trade
prd: 748
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Can a business pick several things it sells, or several trades it sells to, or only one of each?

## The decision, in plain words

One of each, like the size: picking another replaces the first. Regions and rivals can be several, each tapped on and off.

## The intro, for fun

The page asked what we sell, and we tried to answer everything.

## The punchline, for fun

It kept the last answer, and kindly set the others aside.

## The options, in plain words

A. One offering and one trade, the option built
B. Several offerings and trades, each chip toggled on and off like regions
C. Several offerings, one trade

## What I had to decide

Whether offering and trade hold one confirmed value or several, on Settings › Business.

## What I did meanwhile

Offering, trade and size hold one confirmed claim each: tapping another chip, typing another value under Other or moving the slider rejects the confirmed claim through claim_set_state, then picks the new one with claim_pick. Region and rival hold several and toggle. The sentence lists every confirmed value of a kind, so data with two offerings still reads right.

## What it costs to change later

One set of kinds in apps/galaxy/src/business/model.ts (SINGLE) and its tests; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says offering and trade chips and region toggles, but never says whether a chip list is one choice or several

```

<!-- /omni-outbox-settled: s2-01-one-offering-one-trade -->

<!-- omni-outbox-settled: s2-02-repositories-tab-test-touched -->

## s2-02-repositories-tab-test-touched — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-repositories-tab-test-touched
prd: 748
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Adding the Business tab changed a check on the Repositories page, which this piece of work was not meant to touch. Is that fine?

## The decision, in plain words

Yes: the check lists the Settings tabs, so it now expects Business too. Nothing on the Repositories page itself changed.

## The intro, for fun

We added a door to the hallway, and the room next door noticed.

## The punchline, for fun

Its guest list now has one more name on it.

## The options, in plain words

A. Edit the one test assertion in s2, the option built
B. Leave the test red until s4 takes it, since s4 owns the folder

## What I had to decide

Whether s2 may edit apps/galaxy/src/repositories/render.test.ts, outside its territory, to list the new tab.

## What I did meanwhile

The repositories render test's tabs assertion now expects Fleets · Repositories · Business; no source file under apps/galaxy/src/repositories/ changed. Without it the test fails, since SETTINGS_TABS is shared.

## What it costs to change later

One test assertion; s4, which owns apps/galaxy/src/repositories/, may meet it in a merge.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the Settings path lists s2 owns but leaves out the repositories render test, which lists the tabs too

```

<!-- /omni-outbox-settled: s2-02-repositories-tab-test-touched -->

<!-- omni-outbox-settled: s2-03-wrong-claims-folded-skip-per-visit -->

## s2-03-wrong-claims-folded-skip-per-visit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-wrong-claims-folded-skip-per-visit
prd: 748
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

What does the page show for a fact someone marked wrong, and what does Skip remember?

## The decision, in plain words

A fact marked wrong moves to a folded list at the bottom, where a tap on ✓ brings it back. Skip only folds the picks away for this visit and stores nothing, so the picks are back on the next visit.

## The intro, for fun

Some answers were wrong, and one person was not ready to answer at all.

## The punchline, for fun

Both were shown the side door, and it stays unlocked.

## The options, in plain words

A. Folded list for wrong facts, Skip for this visit only, the option built
B. Hide wrong facts from the page entirely, Skip for this visit only
C. Folded list, and Skip remembered in a cookie so the picks stay folded

## What I had to decide

Where rejected claims show on Settings › Business, and whether Skip is remembered between visits.

## What I did meanwhile

Rows list confirmed and proposed claims; rejected ones sit under a folded 'Marked wrong · N' with ✓ enabled. Skip sets page state only (no storage, no cookie); reloading shows the picks again. Opening the page still makes the business itself through business_open, as the spec asks, with no claim.

## What it costs to change later

A few lines of apps/galaxy/src/business/BusinessView.tsx and model.ts; remembering Skip would need a cookie or a stored flag.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the row is kept and leaves the sentence, and that Skip stores nothing, but not where a kept row shows or whether Skip lasts

```

<!-- /omni-outbox-settled: s2-03-wrong-claims-folded-skip-per-visit -->

<!-- omni-outbox-settled: s5-01-wrong-citation-is-skipped -->

## s5-01-wrong-citation-is-skipped — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-wrong-citation-is-skipped
prd: 748
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When an agent logs that it used a business fact, but names one the business does not have, or gives no run to file it under, what should happen?

## The decision, in plain words

The run under a wrong name is not logged: the agent reads one line saying it was skipped and carries on. Naming the run is optional.

## The intro, for fun

An agent thanked a source that does not exist.

## The punchline, for fun

The thank-you note was returned unopened, and nobody minded.

## The options, in plain words

A. A. The server judges the ids, a wrong one is skipped with exit 0, and the run name is optional, the option built.
B. B. The command refuses a malformed id and a missing run name as a usage error (exit 2), which can stop a think-big run.
C. C. As A, but the run name is required.

## What I had to decide

Whether omni business cited checks claim ids itself and stops with a usage error, and whether --ref is required.

## What I did meanwhile

The ids go to the server as given; a wrong or unknown id comes back 400 or 404 and the command prints a citation skipped line with exit 0. Only no ids or no --by is a usage error (exit 2). --ref may be left out and is stored as null. The server maps an unknown id (P0002) to 404.

## What it costs to change later

A few lines in kit/bin/commands/business.mjs and apps/galaxy/src/business-api/api.ts, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec shows --by and --ref always given, and says any failure skips with exit 0, but does not say whether a malformed id is a usage error or a failure

```

<!-- /omni-outbox-settled: s5-01-wrong-citation-is-skipped -->

<!-- omni-outbox-settled: s3-01-when-rivals-are-guessed -->

## s3-01-when-rivals-are-guessed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-when-rivals-are-guessed
prd: 748
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

How often should the business page ask for guessed rivals, since each ask costs one call to the model?

## The decision, in plain words

It asks once the three picks are in, and again only when one of them changes. A later visit with guesses still waiting to be answered does not ask again.

## The intro, for fun

The page wanted to guess our rivals every time we walked past.

## The punchline, for fun

We asked it to wait until we changed our answers.

## The options, in plain words

A. Ask when the picks change, and on a visit with no guess waiting, the option built
B. Ask on every visit with the three picks in
C. Ask only the first time the three picks are complete, never again

## What I had to decide

When Settings › Business calls the suggest-rivals route: on every visit with the three picks in, or only when the picks change.

## What I did meanwhile

The page asks when offering, trade and region are confirmed and their key differs from the last one asked in this visit. On load, the key counts as asked when a proposed rival is already waiting, so a reload with guesses pending costs nothing. A visit with no guess waiting asks once. The route reads the picks from the database itself rather than trusting the page, and drops every rival the business already holds in any state.

## What it costs to change later

A few lines of the effect in apps/galaxy/src/business/BusinessPage.tsx; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the server asks once offering, trade and region are picked, and names one model call per suggestion request as the cost, but not whether a revisit asks again

```

<!-- /omni-outbox-settled: s3-01-when-rivals-are-guessed -->
