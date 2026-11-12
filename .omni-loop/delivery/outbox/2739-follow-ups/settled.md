# Settled outbox items — PRD 2739

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-bug-check-product-command-touch -->

## s2-01-bug-check-product-command-touch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-bug-check-product-command-touch
prd: 2739
slice: s2
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

The check of a product bug record lives in a command file the slice's territory does not list. May the slice change it so the check can read which bug the record is?

## The decision, in plain words

The slice made a small change to the bug command so that the product check can take a bug number or say it is new, and then look for the follow-up files of that bug.

## The intro, for fun

The rule lived in one room, the door to it in another.

## The punchline, for fun

So we oiled the hinge and left the furniture alone.

## The options, in plain words

A. A. Change the bug command as built, so the product check takes a bug number or says it is new.
B. B. Move the flags into a lib helper and keep the command file untouched, which needs a territory change in the plan.

## What I had to decide

Changed kit/bin/commands/bug.ts: `bug check --product` now accepts --bug <n> or --new (both were refused for check), and runs the Still open check. Undo by reverting that file and the two tests; the lib stays.

## What I did meanwhile

The slice carries on with the lib, the tests and the skills inside its territory.

## What it costs to change later

One file outside the listed territory, about 20 lines; a different answer costs a revert of those lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 omits the command file that holds the product check (author).

```

<!-- /omni-outbox-settled: s2-01-bug-check-product-command-touch -->

<!-- omni-outbox-settled: s3-01-postpone-item-slice -->

## s3-01-postpone-item-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-postpone-item-slice
prd: 2739
slice: s3
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

A question raised while looking after a pull request belongs to no step of the plan, so which step should it be filed under?

## The decision, in plain words

It is filed under its own name for that work, after the last step of the plan, so it never reads as part of a step that is already done.

## The intro, for fun

Every question needs a home, even one born after the plan ended.

## The punchline, for fun

So it got a room of its own, at the end of the hall.

## The options, in plain words

A. File it under its own care name, after the last step of the plan.
B. Ask for the step each time the reply is posted, and refuse without one.
C. File it under the last step of the plan.

## What I had to decide

Every outbox item id needs a slice shaped like `s<n>` (`OutboxItemIdSchema`), but `omni care reply --verdict later` runs on the feature PR, which belongs to no slice of the plan, and the spec names no `--slice` flag. The item is raised on the slice `care-s0` (`POSTPONE_SLICE` in `kit/lib/care/later.ts`), its id `care-s0-<nn>-postpone-<slug>`, and its wave is the plan's last wave (1 when the plan names none).

## What I did meanwhile

Built it so: `care-s0` is one constant, the wave is read from the plan. Nothing parses an item's slice against the plan, so the gate, the settle and the rework read it like any other item.

## What it costs to change later

A constant: changing the slice name or adding a `--slice` flag touches `kit/lib/care/later.ts` and `kit/bin/commands/care.ts`; items already written keep their ids.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Omni page groups items by slice in a way that would show care-s0 oddly.

```

<!-- /omni-outbox-settled: s3-01-postpone-item-slice -->

<!-- omni-outbox-settled: s3-02-thread-url-is-pr-and-id -->

## s3-02-thread-url-is-pr-and-id — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-thread-url-is-pr-and-id
prd: 2739
slice: s3
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

The page the kit reads gives no link to each review comment, so what link should a kept point carry to say which comment it came from?

## The decision, in plain words

A kept point links to its pull request, followed by the comment thread's own name, and shipping finds the point and the question by that same link; a point a person chose to fix now needs no kept file.

## The intro, for fun

Every comment needs an address, even when the map shows only the street.

## The punchline, for fun

So the street plus the door name it is.

## The options, in plain words

A. Link to the pull request followed by the thread's name, and match on that.
B. Add each comment's link to what the page answers, then link straight to the comment.
C. Match on the reviewer's words instead of a link.

## What I had to decide

The spec names the source `PRD #<n> · <thread url>`, read in `omni ship` "through the reader `omni care` already uses". That reader, the loop's reads (`LoopThreadSchema`, PRD 1665), carries a thread's id and its comments but no comment url, and `kit/test/no-gh-reads.test.ts` forbids a `gh` GraphQL query in `kit/bin/commands/care.ts`. So the thread url is the pull request's url, `#`, then the thread id (`threadUrl` in `kit/lib/care/later.ts`, e.g. `https://github.com/acme/widgets/pull/9#PRRT_x`): `omni care reply --verdict later` finds the thread among the PRD's feature PR and sub-PRs through the loop's reads and writes that url into the follow-up's source and the item; `omni ship` builds the same url for each `later` thread and matches the source exactly and the item by naming it whole. A link opens the pull request, not the comment. An item settled `drifted` (the person chose to fix it in this PRD) needs no follow-up file, since the rework deletes it; without that the PRD could never ship after a fix-it-now answer.

## What I did meanwhile

Built it so, with tests in `kit/bin/care-later.test.ts` and `kit/lib/delivery/ship-review.test.ts` (no file, no item, both, another thread of the same PR, a sub-PR, a closed sub-PR, drifted, unreadable threads).

## What it costs to change later

Low: one function names the url; if the Omni page's contract later carries comment urls, `threadUrl` changes and the follow-up files already written keep the old form, which `omni ship` would then not match.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people want the link to open the comment itself rather than the pull request.
- (author) The spec did not say what a fix-it-now answer does to the file check.

```

<!-- /omni-outbox-settled: s3-02-thread-url-is-pr-and-id -->

<!-- omni-outbox-settled: s3-03-ship-tests-outside-territory -->

## s3-03-ship-tests-outside-territory — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-11-12T16:29:19Z
- Channel: feature pull request #2740
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2740#issuecomment-6829457936
- Basis: contradiction-marker — the answer says "no", "not", "never", which reads as a change to the recorded choice
- Closed: no — the build and the decision disagree until a rework sub-PR brings them back in line (/omni:yolo-fix)
- Rank: high
- Bears on: N-PRODUCT-12
- Raised: 2026-11-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
no, because omni ship must look at review replies only when there is a review. Some repositories never review: with no review on the PRD's pull requests, ship must never be blocked and never say not judged. (Person's words: "what if there is NO PR review, like never because they are none. Hopefully that would not block? as some repository does not do reviews.")
```

### The item, as it was raised

```text
---
id: s3-03-ship-tests-outside-territory
prd: 2739
slice: s3
rank: high
bears-on: N-PRODUCT-12
raised: 2026-11-12
wave: 2
---

## The question, in plain words

Shipping now reads the pull request's review first, so three older tests that ship a PRD needed a stand-in for that read, one of them in a file that proves a rule: was it right to change them?

## The decision, in plain words

The three tests now hand shipping an empty stand-in, so they keep checking what they checked and never reach the network; the new tests of a later reply live in a file of their own.

## The intro, for fun

Three old tests learned that shipping now looks over its shoulder.

## The punchline, for fun

They got a stand-in, so nobody calls the outside world.

## The options, in plain words

A. Hand the three tests an empty stand-in for the read, and keep the new tests in a file of their own.
B. Move the shipping test out of the rule's proof file into the shipping tests.
C. Leave the old tests as they were, and let them fail until someone decides.

## What I had to decide

`omni ship` became a command that reads the loop (`withoutContext`, `loopReadsFor`), so `main(['ship', '42'])` with no `reads` would try the Omni page with the machine's own sign-in, and fail on CI. Outside s3's territory: `kit/bin/omni.test.ts` ("ship names each rewritten file at its new path"), one of the files that enforce N-PRODUCT-12 (omni runs, and does not refuse, where no kit is installed), and `kit/test/profiles.test.ts` (checks clean, settles, ships) now pass `reads: fakeLoopReads()`, a PRD with no pull request, which the gate reads as nothing to judge. The N-PRODUCT-12 tests themselves are unchanged, and `omni ship 9` (a PRD not in the inbox) reads nothing, so the session-record test of that file is unchanged too. The `later` tests of `omni care reply` went into a new `kit/bin/care-later.test.ts` instead of `kit/bin/care.test.ts`, which enforces BR-PRODUCT-72 and stays untouched (testing form: a law's file stays its owner's).

## What I did meanwhile

Changed the two files, one argument each plus an import, added the new test file, and ran all three suites green.

## What it costs to change later

A constant: reverting the lines restores the files, with the network risk back; the new test file can move into `kit/bin/care.test.ts` if its owner prefers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner of N-PRODUCT-12 accepts an unrelated test of its proof file taking a stand-in argument.

```

- Became: BR-PRODUCT-130

<!-- /omni-outbox-settled: s3-03-ship-tests-outside-territory -->
