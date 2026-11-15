---
prd: 2906
title: A plain-language status for this session
blocked-by: none
spec: file
phase0: server
---

## Problem

A person who runs the loop asks "status" many times a day, and the answer is written for the agent,
not for them: `omni now` prints `PRD 2872 reviewer · building · building s3 tabs · stuck s5`, and an
agent asked in its own words answers with branches, sub-PRs, outbox items and check names. The person
then asks "explain this very simply", every time. A product manager following four or five pieces of
work at once cannot tell, in a few seconds, where each one stands, whether the agent waits on them,
and where to click.

`/omni:status` does not answer that question either: it is the repository's overview (how many PRDs
sit at each stage, a bar, the person's PRDs), read from git, the same whichever terminal asks.

`omni now` (PRD 1208) already knows most of the facts: the work a session is on, its stage, its links
(the work's Omni page, its pull request), the slices in flight or stuck and the approval wait. It
words them in loop terms, and it knows only three stages of a bug fix (`in progress`, `fix PR open`,
`merged`).

What a good status is, from the guides on status updates (Atlassian, project-management.com,
GitScrum): the answer first, readable in three seconds; what the reader must do kept apart and never
buried, "nothing" being an answer; a block said early, with what happens next; the same layout every
time; two or three next items at most.

## Solution

**`/omni:status` becomes this session's status, in plain words.** Asked "status" (or `/omni:status`),
the agent prints one block, always laid out the same way:

```text
🟢 On track: the fix is done, the automatic checks are running.

Bug fix #2891 · Budgets ignore an approved raise
Step 4 of 6
  ✓ Understood  ✓ Reproduced  ✓ Fixed  ▶ Checks running  ○ Your review  ○ Merged
Right now: I'm waiting for the last check to finish.

You: nothing to do right now.
Next: once the checks pass, I mark it ready, and you review and merge it.

Bug page:     https://www.omni-loop.xyz/…
Pull request: https://github.com/…/pull/2892  (where the change is reviewed, then merged by you)
Checked just now.
```

1. **The verdict line** comes first, one of three: `🟢 On track`, `🟡 Waiting for you`, `🔴 Stuck`,
   then a colon and the one-sentence answer. 🟢 is never shown while a check is red or not known.
2. **The work line:** its kind in the glossary's words (`PRD`, `Bug fix`, `Visual update`), its
   number and its title.
3. **The step:** `Step <k> of <N>`, then every step of its kind on one line, in its short name, `✓` done, `▶` the one it
   is at, `○` to come.
4. **Right now:** one sentence the agent adds, in plain words, only when this session is the one
   doing the work and knows what it is doing at this moment. After a `/clear` it knows nothing and the
   line is left out: the facts answer alone.
5. **You:** always present. What the person must do, with where to do it, or
   `nothing to do right now.`
6. **Next:** one or two items, never more.
7. **The links:** the work's Omni page (`omni dossier link`, as the Links rule says; the GitHub issue
   when it has no page) and its pull request, each with a few plain words on what it is.
8. **Details**, only when a check failed: `Details (RAW, the check's real name, for developers):
   <check> · failed`, one line per failed check, at most three.
9. **The freshness line:** `Checked just now.`, or `Checked <m> min ago (GitHub did not answer).`

**The steps of each kind of work**, worked out from facts (below):

| work | steps |
|---|---|
| PRD, before approval | Shaping the idea → Writing it down → Waiting for your approval → Ready to build |
| PRD, once approved | Planning → Building (k of n parts) → Checking it all together → Questions for you, or Ready for your review → Shipped |
| Bug fix | Understanding the bug → Trying to reproduce it → Reproduced, fixing it → Fix done, checks running → Ready for your review → Merged |
| Visual update | Showing you options → Applying your pick → Checks running → Ready for your review → Merged |

A PRD shows the brainstorm's steps until it is approved, then the build's. Its fifth build step is
`Questions for you` while the gate is red (questions wait on its feature PR) and `Ready for your
review` once the feature PR is ready.

**How each step is read.** Every fact is one the kit already keeps, read offline, except the pull
request's state and checks, which `--fetch` reads:

| work | step | read when |
|---|---|---|
| PRD | Shaping the idea | the session's draft dossier is open and the PRD has no folder |
| PRD | Writing it down | its folder exists, it is not approved, and no approval is asked |
| PRD | Waiting for your approval | an approval wait is running for it, or its phase-0 PR is open |
| PRD | Ready to build | approved (inbox), with no slice started |
| PRD | Planning | approved, no `plan.md` |
| PRD | Building (k of n parts) | a slice of its board is not merged: `k` merged of `n` |
| PRD | Checking it all together | every slice merged, the feature PR a draft, no open question |
| PRD | Questions for you | every slice merged, open outbox items in its folder |
| PRD | Ready for your review | the feature PR is open and not a draft |
| PRD | Shipped | its folder is in shipped |
| Bug fix | Understanding the bug | the session is on the fix, no fix branch exists |
| Bug fix | Trying to reproduce it | the fix branch exists, no pull request from it |
| Bug fix | Reproduced, fixing it | a draft pull request whose changed files are tests and the fix's folder only |
| Bug fix | Fix done, checks running | a draft pull request that changes more than tests |
| Bug fix | Ready for your review | the pull request is open and not a draft |
| Bug fix | Merged | its folder is on the default branch |
| Visual update | Showing you options | the session is on it, no fix branch exists |
| Visual update | Applying your pick | the fix branch exists, no pull request from it |
| Visual update | Checks running | a draft pull request, or an open one whose checks are not all green |
| Visual update | Ready for your review | the pull request is open, not a draft, its checks green |
| Visual update | Merged | its folder is on the default branch |

**The verdict:** 🔴 when a check failed, a slice is stuck, or the pull request was closed without
merging (`Stopped: the pull request was closed without merging`); 🟡 when **You** asks something; else
🟢. A step whose checks are not known reads `🟢 On track` only when no check is involved; with a
pull request open it reads `🟡 Waiting: the checks are not known right now (GitHub did not answer)`.

**One table of plain words** (`kit/lib/now/status/words.ts`) holds every step's name, every verdict
sentence, every **You** and **Next** line, and each technical word with its explanation in brackets:
`pull request (where the change is reviewed, then merged by you)`, `checks (the tests GitHub runs on
every change)`, `draft (not yet asked for review)`, `merge (accept the change into the product)`,
`PRD (the written plan of a feature)`. A technical word appears at most once in a block, explained the
first time. Every status anyone sees draws its words from this one table.

**The commands:**

- `omni now --status` prints the block, without the **Right now** line, reading only this computer.
- `omni now --status --fetch` first reads the work's pull request (its state, its changed files and its
  checks) through the reads the background refresh already uses, with a 5-second limit, and keeps
  what it read beside the links; when they do not answer, it shows the last copy kept and says how old
  it is.
- `omni now --json` gains a `status` key: `{ verdict, kind, steps, at, you, next, details, checkedAt }`,
  so that the status line and the band can show `Step 4 of 6` later. `omni now` with no flag prints
  what it prints today.
- `/omni:status` runs `omni now --status --fetch`, prints the block as it came in a `text` block, and
  inserts its one **Right now** line under the step line when this session is the one doing the work.
  A session on nothing prints `Nothing is running in this terminal.` and `/omni:dashboard shows all
  your work.`

**`/omni:dashboard` is today's overview, renamed.** The skill `/omni:status` is today moves, unchanged
in what it shows, to `/omni:dashboard`, which runs the new command `omni dashboard [--fetch]`.
`omni status` with no PRD number keeps printing the same overview, and `omni status <n>` stays the
outbox gate: the skills that ship run it. The help, the kit's README, the user guide's pages that
name `/omni:status` and the skills diagram are updated to the two names.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | cli | flag `--status` on `omni now` | follows `--json` ← kit/bin/commands/now.ts |
| vertuo-omni-loop | cli | flag `--fetch` on `omni now --status` | follows `omni status [--fetch]` ← kit/lib/help/entries.ts:81 |
| vertuo-omni-loop | cli | command `omni dashboard [--fetch]` | follows the `status` entry ← kit/lib/help/entries.ts:79 |
| vertuo-omni-loop | code | folder `kit/lib/now/status/` with `steps.ts`, `words.ts`, `render.ts` | no written convention: follows `kit/lib/now/` (`now.ts` pure, `read.ts` the reads) |
| vertuo-omni-loop | code | key `status` on `Now` | follows `wait?`, `sync?` on `Now` ← kit/lib/now/now.ts:68 |
| vertuo-omni-loop | skill | `/omni:dashboard` in `kit/plugin/skills/dashboard/SKILL.md` | follows `kit/plugin/skills/status/SKILL.md` |
| vertuo-omni-loop | words | `Bug fix`, `Visual update`, `PRD`, `Question` | the product's glossary (`omni kb glossary`): `Visual update (not: visual fix)` |

## Decisions

- **`/omni:status` is this session only** (Pierre, 2026-11-15): work across terminals is
  `/omni:dashboard`'s. The skill named `status` changes meaning; the command `omni status` does not,
  since `omni status <n>` is the outbox gate every shipping skill runs.
- **Today's overview is renamed `/omni:dashboard`, unchanged** (Pierre): the per-terminal part ("your
  terminals", one line per session with its step and **You**) is a later PRD, so this one stays
  small.
- **The step comes from facts, and the agent adds what it is doing now** (Pierre): the facts give the
  frame (step, verdict, **You**, links); the agent adds one **Right now** sentence. On links and on
  **You**, the facts win; on "right now", the agent does.
- **The objection was accepted.** persona:F-E Developer (skeptical, fears AI slop reaching
  production): "If a friendly 'on track' hides that a check is red, I trust the tool less: show me the
  failing check's real name." The block gains the **Details (RAW)** line on a failed check, and 🟢 is
  never shown while a check is red or not known. Settled: `accepted`.
- **No proof video** (Pierre): the status is a terminal answer.
- **A stop the facts cannot see** (a bug that cannot be reproduced, a fix that needs a product
  decision) is said by the **Right now** line of the session that stopped; the facts show it as the
  step it stopped at. Taken alone as the most reversible: a stop marker the skills write can be added
  later without changing the block.
- **"Reproduced, fixing it"** is read from the pull request's changed files (tests and the fix's
  folder only), since `/omni:bug-fix` opens its draft on the reproduction alone. Taken alone; a
  reproduction kept outside a test file reads as `Fix done, checks running` one step early.
- **Words in the glossary's terms:** "Visual update", never "visual fix"; "Questions for you", never
  "outbox items".

## User stories

- As a product manager following a bug fix, I type "status" and read in three seconds that the bug is
  reproduced and being fixed, that nothing waits on me, and where the pull request is.
- As a product manager whose PRD's questions are waiting, I read `🟡 Waiting for you`, how many
  questions, and the link where I answer them.
- As a person back after a `/clear`, I still get the step, **You** and the links, from the facts alone.
- As a developer, when a check failed, I see its real name on the **Details (RAW)** line.
- As someone who wants every PRD at once, I type `/omni:dashboard` and get today's overview.

## Scope

In:

- `kit/lib/now/status/` (steps, words, render), the `status` key of `omni now --json`, `omni now
  --status [--fetch]`, the pull request's state, files and checks kept beside the links.
- The skill `/omni:status` rewritten; the skill `/omni:dashboard` and the command `omni dashboard`.
- The help entries, `kit/README.md`, the user guide's pages naming `/omni:status`, the skills diagram,
  `kit/test/plugin.test.ts`, the rebuilt `kit/dist/`.

Out:

- The per-terminal part of the dashboard (a later PRD).
- The status line and the Omni band showing the step (they can read `status` once it exists).
- A stop marker written by the skills.
- Any change to `omni status`, with or without a PRD number.

## Test seams

Following `omni kb show testing`: tests beside the code, a command through `main()` on a fixture
repository (`makeRepo()`), no test calling GitHub or Supabase.

- **`kit/lib/now/status/steps.test.ts`** (pure): per kind, a table of facts → the expected step, every
  row of **How each step is read**; the verdict: 🔴 on a failed check, a stuck slice or a closed pull
  request, 🟡 when **You** asks something, never 🟢 with a check red or not known; **You** never
  empty.
- **`kit/lib/now/status/render.test.ts`** (pure): the lines in their order; **Next** at most two items;
  **Details** only on a failed check, at most three; the Omni page, else the GitHub issue; the
  freshness line.
- **`kit/lib/now/status/words.test.ts`**: every step of every kind has a name; a block never shows a
  loop word (`branch`, `slice`, `sub-PR`, `outbox`, `wave`, `CI`) outside the table's explained forms,
  and explains each technical word once.
- **`kit/bin/commands/now.test.ts`**: `omni now --status` offline on a fixture repository; `--fetch`
  with the reads stubbed, answering and timing out; `--json` carries `status`; `omni now` alone
  prints what it prints today; run outside the loop it answers the session is on nothing, exit 0.
- **`omni dashboard`** prints exactly what `omni status` prints, with and without `--fetch`; the help
  lists both.
- **`kit/test/plugin.test.ts`**: the plugin ships `status` and `dashboard`; `kit/test/dist.test.ts`
  holds the bundle current.

## Risks

Merging this publishes a new meaning for `/omni:status` in the kit every repository updates to, and a
new skill and command. Rolled back by reverting the feature PR: the old skill comes back under its old
name, and `omni status` never changed. A person used to `/omni:status` for the overview finds it under
`/omni:dashboard`; the new `/omni:status` says so in its nothing-running line.

`--fetch` reads the pull request through the reads the kit already makes, with a 5-second limit; a
slow or refused read shows the last copy with its age and never blocks.

**The locked laws** (`omni kb laws --paths` on the files above):

- BR-PRODUCT-3: an agent applying the override label itself would wave its own work through the gate,
  with no person answering the open questions. Kept: the status reads and never labels. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-5: a feature leaving draft while a question is open would let a person merge undecided
  work. Kept: the status shows `Questions for you`, never `Ready for your review`, while one is open,
  and changes no pull request. Changing it needs @pierrederval or @dervalp to approve the pull request
  on GitHub.
- N-PRODUCT-15: an agent merging into `main` would ship unreviewed work to every user. Kept: **You**
  always names the person as the one who merges; the status merges nothing. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.

The rules it reads under: BR-PRODUCT-90 (a session whose branch names a work shows that work) and
N-PRODUCT-12 (outside the loop, `omni now` answers nothing and exits 0) hold for `--status` too.

**The Legal entries:** L-AIACT-1 (content an agent makes says so): the **Right now** line speaks as
the agent ("I'm waiting…"), never in the person's name. L-GDPR-1: the block shows only the session's
own work, read from the person's own checkout. No other entry touched.

**The business laws** (`omni kb business-laws --spec`):

- BL-APPROVALS-1, "An approval covers exactly the files the approver read; any later change voids it,
  and the build waits for a new one": kept. The status approves nothing, and a PRD whose approval a
  change voided reads `Waiting for your approval` again, from the same approval wait.
- BL-ASK-1, "An answer a person gave is never changed or reworded afterwards": kept. The status only
  reads; its **Right now** line is the agent's own words in its own name, never a person's answer.

## Acceptance criteria

Acceptance scenarios are off in this repository: each criterion becomes an ordinary test.

1. In a session on a bug fix whose draft pull request changes only tests, `omni now --status` prints
   `Step 3 of 6` with `▶ Reproduced, fixing it`, a **You** line and both links.
2. With a failed check, the verdict is `🔴 Stuck`, and **Details (RAW…)** names the check; 🟢 never
   shows while a check is red or not known.
3. A PRD whose slices are 4 merged of 6 reads `Building (4 of 6 parts)`; with every slice merged and
   open outbox items, `🟡 Waiting for you` and `Questions for you`, with the link to answer them.
4. A session on nothing prints `Nothing is running in this terminal.` and the `/omni:dashboard` line.
5. `--fetch` with GitHub not answering in 5 seconds shows the last copy and `Checked <m> min ago
   (GitHub did not answer).`
6. No block shows a loop word outside its explained form; **Next** holds at most two items.
7. `omni now` with no flag prints exactly what it printed before; `--json` carries `status`.
8. `omni dashboard` prints exactly what `omni status` prints; `/omni:dashboard` is shipped and
   `/omni:status` runs `omni now --status --fetch`.
