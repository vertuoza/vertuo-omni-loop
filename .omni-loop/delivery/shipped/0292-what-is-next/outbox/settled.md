# Settled outbox items — PRD 292

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-hand-off-blocks-printed-how -->

## s1-01-hand-off-blocks-printed-how — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1
- Stays here: A presentation choice in two skill templates, cheap to change, with no lasting rule, invariant or architectural consequence; nothing in the knowledge base covers it.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-hand-off-blocks-printed-how
prd: 292
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

At the end of a brainstorm, should the folder, the stages and the next steps all be shown as fixed-width text, or only the parts that must line up?

## The decision, in plain words

The folder and the stages are shown as fixed-width text, so the tree and the arrows line up. The next steps are shown as ordinary formatted text, so the heading is bold and the steps read as a list.

## The intro, for fun

Some parts of a reply want a ruler, and some want a bold heading.

## The punchline, for fun

The arrows got the ruler, and the heading got the bold.

## The options, in plain words

A. The folder and the stages as fixed-width text, the next steps as formatted text: the option built.
B. All three as fixed-width text, exactly as the spec draws them, so the heading shows its stars.
C. All three as formatted text, leaving the tree and the arrows free to drift.

## What I had to decide

How the three blocks that end `/omni:brainstorm` step 10, and the two-step block that ends `/omni:plan` step 7 run alone, are printed. The spec draws all three as `text` fences, yet its What is next? block holds `**What is next?**` and a numbered list, which only render as Markdown.

## What I did meanwhile

The folder and the stages are `text` fences, and step 10 says to print each in a code block so the tree and the arrows line up. The What is next? templates in both skills are `markdown` fences, printed as Markdown, with `/omni:yolo <n>` alone on the reply's last line. `kit/test/plugin.test.mjs` reads only the phrases and the last fenced line, so every option below passes it.

## What it costs to change later

A fence language and one sentence per block, in two skills. No code, no command, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec, its before/after page and the plan do not say whether the What is next? block is printed inside a code block or as Markdown: the before/after page draws it in a terminal, where the two look alike.

```

<!-- /omni-outbox-settled: s1-01-hand-off-blocks-printed-how -->

<!-- omni-outbox-settled: s1-02-issue-step-test-reads-to-next-step -->

## s1-02-issue-step-test-reads-to-next-step — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1
- Stays here: A local test-reading choice in one file, cheap to change, with no lasting rule, invariant or architecture decision to record.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-02-issue-step-test-reads-to-next-step -->
