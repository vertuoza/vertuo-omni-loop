# Settled outbox items — PRD 1954

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: e2e-s1-01-home-title-test-level -->

## e2e-s1-01-home-title-test-level — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: e2e-s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: e2e-s1-01-home-title-test-level
prd: 1954
slice: e2e-s1
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The new browser test checks that the arcade home page shows the title OMNI LOOP. Should its failure count as breaking a critical flow, or is it an ordinary check?

## The decision, in plain words

The test was written as an ordinary (standard) check, because nobody could be asked while the PRD was being built.

## The intro, for fun

A test walks into the arcade and asks how serious it is.

## The punchline, for fun

Pick a letter and its badge is settled.

## The options, in plain words

A. A. Standard, as written: the test keeps its prd-1954 tag and no critical tag.
B. B. Critical: the test is tagged critical and flow-arcade-landing, so its failure breaks the flow arcade-landing.

## What I had to decide

Does this test cover the flow arcade-landing (a visitor reaches the arcade and sees what it is), and does its failure break that flow? Recommended: A, standard, since the check only reads the page title.

## What I did meanwhile

The test stays standard, with only the tag prd-1954 and no critical tag.

## What it costs to change later

Changing it later means editing the tags of the test file `e2e/tests/arcade-home-title.e2e.ts`: adding `critical` and `flow-arcade-landing` (option B), or removing them again. Nothing else moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which flow of the first drafted list this test covers, and whether its failure breaks it (author)

```

<!-- /omni-outbox-settled: e2e-s1-01-home-title-test-level -->

<!-- omni-outbox-settled: e2e-s1-01-home-title-test-level -->

## e2e-s1-01-home-title-test-level — drifted

- Verdict: drifted
- Approved by: neitsabbb
- Approved at: 2026-10-14T17:58:48Z
- Channel: feature pull request #1955
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1955#issuecomment-6174868042
- Basis: stated — the answer is settled as "drifted" because a human said so, not because a comparison read it
- Closed: no — the build and the decision disagree until a rework sub-PR brings them back in line (/omni:yolo-fix)
- Stays here: the answer sets one test's level (tags on one file), a choice about this test only, not a lasting rule about the product or how the repository builds.
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: e2e-s1
- Wave: 1

### The answer, as it was given

```text
B. B. Critical: the test is tagged critical and flow-arcade-landing, so its failure breaks the flow arcade-landing.
```

### The item, as it was raised

```text
---
id: e2e-s1-01-home-title-test-level
prd: 1954
slice: e2e-s1
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The new browser test checks that the arcade home page shows the title OMNI LOOP. Should its failure count as breaking a critical flow, or is it an ordinary check?

## The decision, in plain words

The test was written as an ordinary (standard) check, because nobody could be asked while the PRD was being built.

## The intro, for fun

A test walks into the arcade and asks how serious it is.

## The punchline, for fun

Pick a letter and its badge is settled.

## The options, in plain words

A. A. Standard, as written: the test keeps its prd-1954 tag and no critical tag.
B. B. Critical: the test is tagged critical and flow-arcade-landing, so its failure breaks the flow arcade-landing.

## What I had to decide

Does this test cover the flow arcade-landing (a visitor reaches the arcade and sees what it is), and does its failure break that flow? Recommended: A, standard, since the check only reads the page title.

## What I did meanwhile

The test stays standard, with only the tag prd-1954 and no critical tag.

## What it costs to change later

Changing it later means editing the tags of the test file `e2e/tests/arcade-home-title.e2e.ts`: adding `critical` and `flow-arcade-landing` (option B), or removing them again. Nothing else moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which flow of the first drafted list this test covers, and whether its failure breaks it (author)

```

<!-- /omni-outbox-settled: e2e-s1-01-home-title-test-level -->
