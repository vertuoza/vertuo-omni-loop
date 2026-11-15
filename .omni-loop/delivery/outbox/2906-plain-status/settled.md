# Settled outbox items — PRD 2906

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-step-line-names -->

## s1-01-step-line-names — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-step-line-names
prd: 2906
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The spec's example and its first acceptance test name the current step differently on the line of steps: a short name in one, the full name in the other. Which should the line show, and what are the short names?

## The decision, in plain words

The step the work is at shows its full name, so the person reads what is happening now; the steps done and to come show short names. A short name never holds a technical word, so a bug fix's fourth step reads Checked rather than Checks running.

## The intro, for fun

Two drafts of one sentence walked into a status block.

## The punchline, for fun

The long one got the arrow, the short ones got the ticks.

## The options, in plain words

A. Full name for the step it is at, short names for the rest, no technical word in a short name: what was built.
B. Short names everywhere, as the spec's example shows, and change the first acceptance test to match.
C. Full names everywhere, and no short names at all.

## What I had to decide

The spec's example prints the strip as `✓ Understood  ✓ Reproduced  ✓ Fixed  ▶ Checks running  ○ Your review  ○ Merged` (short names everywhere), while acceptance criterion 1 asks for `Step 3 of 6` with `▶ Reproduced, fixing it` (the step's full name). The spec names short names only in its example (bug fix); the other kinds' short names were not given. Built in `kit/lib/now/status/words.ts` (`STEPS[*].short`) and `render.ts` (`stepLine`): the step at prints `name`, the others `short`. Short names chosen: PRD before approval Shaped, Written down, Your approval, Ready to build; PRD build Planned, Built, Checked, Your answers or Your review, Shipped; bug fix Understood, Reproduced, Fixed, Checked, Your review, Merged; visual update Options shown, Pick applied, Checked, Your review, Merged. The spec's `Checks running` short became `Checked`, since `checks` is a word the block must explain the first time it appears, and an explanation inside the line of steps on every early step would crowd it; the full names keep `checks`, marked, and are explained there when no line above did.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

Built the line with the full name for the current step and the short names above for the rest, every name in the one table of words, tested in render.test.ts and words.test.ts.

## What it costs to change later

A constant: each short name is one string in the table, and which name the current step prints is one line of the renderer; no stored data, no other reader yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives short names for the bug fix only; whether a person wants other short names for the PRD and visual update steps is not settled anywhere.
- (author) Whether the person prefers the spec example's Checks running as a short name, accepting that the word checks then needs its explanation inside the line of steps.

```

<!-- /omni-outbox-settled: s1-01-step-line-names -->

<!-- omni-outbox-settled: s1-02-steps-when-facts-missing -->

## s1-02-steps-when-facts-missing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-steps-when-facts-missing
prd: 2906
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The table of how each step is read assumes every fact is known. When the build's progress was not read, or a bug fix's changed files are not known, which step should the status show?

## The decision, in plain words

When a fact is missing, the status shows the earlier step rather than claim progress it cannot see: a feature whose build progress was not read reads Ready to build, and a bug fix whose changed files are not known reads Reproduced, fixing it. The first step of a visual update asks nothing of the person, since nothing says the options are on screen yet.

## The intro, for fun

A status that guesses ahead is a weather forecast for yesterday.

## The punchline, for fun

So when a fact is missing, it stays one step behind.

## The options, in plain words

A. Show the earlier step when a fact is missing, and ask nothing on the options step: what was built.
B. Show the later step the facts allow, such as Building for an approved feature with a draft feature pull request.
C. Show a separate Not known yet step line whenever a fact the step needs is missing.

## What I had to decide

Built in `kit/lib/now/status/steps.ts`. `buildPlace`: an approved PRD with a plan and `slices: null` (no board cached) reads `Questions for you` when questions are open and its feature PR is known, `Ready for your review` on an open feature PR, else `Ready to build`; it never reads `Building` or `Checking it all together` without a board, since a feature PR is opened as a draft by `/omni:plan` before any slice starts. `testsOnly`: a bug fix's draft pull request whose `files` is `null` reads `Reproduced, fixing it`, not `Fix done, checks running`. The visual update's `Showing you options` step has `asks: false` (You: nothing to do right now; Next: you pick one of the options), because no fact says the options are on screen. An empty board (no slice) reads as no slice started.

## What I did meanwhile

Built the earlier-step readings above and tested each in steps.test.ts.

## What it costs to change later

A constant per rule: each reading is one branch of a pure function, with no stored data; s2 can also pass the facts so they are rarely missing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person would rather read a separate word such as Not known yet for the step when the build's progress was not read.
- (author) Whether the visual update's first step should say Waiting for you, since the person is the one who picks.

```

<!-- /omni-outbox-settled: s1-02-steps-when-facts-missing -->

<!-- omni-outbox-settled: s1-03-freshness-without-fetch -->

## s1-03-freshness-without-fetch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-freshness-without-fetch
prd: 2906
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The spec words the freshness line for two cases only: checked just now, and an older copy because GitHub did not answer. What should the last line say when the status was read from this computer alone, without asking GitHub, or when nothing was ever read?

## The decision, in plain words

Read from this computer alone, it says how old the copy is, without blaming GitHub, and says just now under a minute. With no copy at all, it says the work was not checked yet, adding that GitHub did not answer only when it was asked.

## The intro, for fun

A clock that only knows two times is right twice a day.

## The punchline, for fun

This one also knows when nobody asked it the time.

## The options, in plain words

A. Say the copy's age without blaming GitHub when it was not asked, and say not checked yet when nothing was read: what was built.
B. Leave the freshness line out when GitHub was not asked.
C. Always print the two lines of the spec, saying GitHub did not answer even when it was not asked.

## What I had to decide

Built in `kit/lib/now/status/render.ts` (`freshnessLine`) and `words.ts` (`FRESHNESS`), from `checked: { at, fetch }` where `fetch` is `answered`, `no-answer` or `not-asked`. `answered`: `Checked just now.` `no-answer` with a copy: `Checked <m> min ago (GitHub did not answer).`, `<m>` at least 1. `not-asked` with a copy: `Checked <m> min ago.`, or `Checked just now.` under a minute. No copy: `Not checked yet (GitHub did not answer).` when asked, `Not checked with GitHub yet.` when not. The spec's `omni now --status` (no `--fetch`) reads only this computer, so its line had no wording in the spec.

Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Built the five lines above in the one table of words and tested each in render.test.ts.

## What it costs to change later

A constant: five strings in the table and one small pure function; s2 only passes whether it asked and whether GitHub answered.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person would rather see no freshness line at all when GitHub was not asked.

```

<!-- /omni-outbox-settled: s1-03-freshness-without-fetch -->

<!-- omni-outbox-settled: s2-01-now-json-status-test -->

## s2-01-now-json-status-test — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-now-json-status-test
prd: 2906
slice: s2
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

Adding the status to the session answer made one older test, in a file this step does not own, fail. May this step loosen that one test so it ignores the new part?

## The decision, in plain words

The test now checks the parts it always checked and no longer insists the answer has nothing else. Nothing about what the status line shows changed.

## The intro, for fun

A new guest arrived at a table set for exactly four.

## The punchline, for fun

We added a chair instead of sending the guest home.

## The options, in plain words

A. A. Loosen that one assertion to ignore the new status key (built).
B. B. Keep the strict assertion and add the full status to its expected answer, which ties that test to every word of the status.

## What I had to decide

Changed one assertion of kit/bin/statusline.test.ts from toEqual to toMatchObject, since omni now --json carries the new status key as the spec asks. Taken alone as the most reversible: restoring toEqual later means listing the status in that test.

## What I did meanwhile

The test keeps proving the work, its stage, its links and what it is doing.

## What it costs to change later

One line in a test outside this step's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No written rule says whether a step may touch a test outside its territory when its change breaks it (author).

```

<!-- /omni-outbox-settled: s2-01-now-json-status-test -->

<!-- omni-outbox-settled: s4-01-guard-tests-follow-status -->

## s4-01-guard-tests-follow-status — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-guard-tests-follow-status
prd: 2906
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Three older guard tests still checked the old overview skill under the name status, outside this slice's files. Should they follow the rename?

## The decision, in plain words

The guard that remembers each skill's steps now remembers status as the session's status, and the guard that wants a link to the PRD's page now checks the dashboard instead. Nothing the old overview did was dropped: it lives on in the dashboard skill.

## The intro, for fun

The old status moved house, and its mail still came to the old address.

## The punchline, for fun

We forwarded the mail.

## The options, in plain words

A. A. Follow the rename: status holds the session status, the dashboard carries the overview's checks (what was built).
B. B. Keep the old snapshot entry and add the same words to the status skill, which would make it name the overview command again.

## What I had to decide

Edited kit/test/skill-steps.snapshot.json (the status entry now holds the session status's one command) and kit/test/skills-dossier-link.test.ts (dashboard replaces status in its list), both outside the territory, since the rename made them fail. A person can instead keep the snapshot and add a dashboard entry.

## What I did meanwhile

The session status stands as built; the guards pass.

## What it costs to change later

Reverting the two small test edits and choosing another guard shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the old snapshot should stay untouched is the owner's call (author).

```

<!-- /omni-outbox-settled: s4-01-guard-tests-follow-status -->

<!-- omni-outbox-settled: s4-02-law-proof-tests-follow-status -->

## s4-02-law-proof-tests-follow-status — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-15T20:40:10Z
- Channel: feature pull request #2908
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2908#issuecomment-6901024964
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-5
- Raised: 2026-11-15
- Slice: s4
- Wave: 3
- Stays here: it accepts this PRD's own changes to three law-proof tests and states no lasting rule about the product

### The answer, as it was given

```text
A. Accept the tests as they are: Keep the rewritten skill tests, the kept gate guard and the looser status line check.
```

### The item, as it was raised

```text
---
id: s4-02-law-proof-tests-follow-status
prd: 2906
slice: s4
rank: high
bears-on: BR-PRODUCT-5
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Three tests that prove the rules on approvals and merging were changed so they test the new plain status. Do you accept these changes?

## The decision, in plain words

The tests now check the new status skill, keeping the check that it never runs the question gate and adding one that it changes no pull request, label or approval. One older check is a little looser, so an extra field in the status output is allowed.

## The intro, for fun

The guards of the gate had to learn a new uniform.

## The punchline, for fun

Same guards, same gate, new name on the badge.

## The options, in plain words

A. Accept the tests as they are: Keep the rewritten skill tests, the kept gate guard and the looser status line check.
B. Tighten the status line test: Keep the skill tests, and compare the whole JSON again, status key included.
C. Restore the old tests: Put the old status skill tests back on the dashboard skill, and write the new ones beside them.

## What I had to decide

The old status skill's tests described the repository overview, which moved to the dashboard skill. They were rewritten for the new skill, keeping the gate guard and adding a no-change guard. In the status line test, one exact comparison became a partial one because the JSON gained a status key. The now test only gained new tests.

## What I did meanwhile

The feature pull request is back to draft. Every check passes except the outbox check, which waits for this answer and for an approving review from a code owner of the changed test files.

## What it costs to change later

Cheap: the tests are plain files. A stricter version means comparing the whole JSON again with the new status key included.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the code owners want the status line test to compare the whole JSON again, including the new status key (author).

```

<!-- /omni-outbox-settled: s4-02-law-proof-tests-follow-status -->
