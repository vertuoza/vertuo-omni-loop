---
id: s1-02-issue-step-test-reads-to-next-step
prd: 292
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec asked the new test to read the issue step with the test file's usual section reader, but that reader stops at the issue's own heading, before the line being tested. How should the test read that step?

## The decision, in plain words

The new test reads the issue step up to the next step's heading and checks the line under the issue's own heading. The shared reader, and every test already using it, stay as they were.

## The intro, for fun

A heading inside a template looked like the end of the chapter.

## The punchline, for fun

The test now reads on to where the chapter really ends.

## The options, in plain words

A. The new test reads the issue step up to the next step's heading, and the shared reader stays as it is: the option built.
B. Teach the shared reader to skip headings inside templates, for every test that uses it.
C. Turn the issue's own heading into bold text, so the shared reader no longer stops there.

## What I had to decide

How `kit/test/plugin.test.mjs` reads `/omni:brainstorm`'s `## 2.` step. The spec's Test seams say to read sections with the file's `skillSection` helper, which ends a section at any line starting with `## `. Step 2's issue template has its own `## Handoff` heading, so the `Next command:` line falls outside what `skillSection` returns.

## What I did meanwhile

The new block slices step 2 from its `## 2.` heading to the `## 3.` heading, checks that the slice starts at `## 2. Open the PRD issue`, and asserts the `## Handoff` heading followed by ``- Next command: `/omni:yolo <n>`, once the phase-0 PR is merged``. `skillSection` is unchanged, so no existing assertion sees different text; steps 10 and 7 still read through it.

## What it costs to change later

One test in one file. Making `skillSection` skip headings inside fenced blocks instead would change the text four existing blocks assert on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names `skillSection` for every seam without noting the template's own heading; whether the reviewer would rather have the helper made fence-aware for every block is not settled.
