# Settled outbox items — PRD 50

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-fun-line-sentence-count -->

## s1-01-fun-line-sentence-count — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-fun-line-sentence-count
prd: 50
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should the check refuse an intro or a punchline made of two short sentences, since the spec asks for one sentence while its own example punchline has two?

## The decision, in plain words

The check refuses a line only when it runs past 120 characters or is not in plain words, and plain words already allow two short sentences at most. Keeping to one sentence stays advice for whoever writes the line.

## The options, in plain words

A. Refuse a line only when it is too long or not in plain words, which allows two short sentences, the option built.
B. Also refuse a line of more than one sentence, which would refuse the spec's own example punchline.

## What I had to decide

Whether `funLineProblems` also caps an intro or a punchline at one sentence. The spec's "What a line may say" says one sentence, in plain words, "the same `plainWordsProblems` rules as the question and the decision" — and `plainWordsProblems` allows two. The spec's own example punchline in its Solution is two sentences. Acceptance criteria 2 and 3 name only the 120-character cap and the plain-words rules.

## What I did meanwhile

`funLineProblems` is `plainWordsProblems` (which refuses more than two sentences) plus the 120-character cap, and nothing else. The one-sentence rule is left to the writer: slice s3 puts it in `/omni:do-work`'s prose.

## What it costs to change later

A one-sentence cap is one more check in `funLineProblems` and a couple of tests. Any open item already carrying a two-sentence line would then fail `omni check outbox` until reworded; settled entries are never graded, so none of them is affected.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's two-sentence example punchline is meant as allowed, or only as an illustration of tone

```

<!-- /omni-outbox-settled: s1-01-fun-line-sentence-count -->

<!-- omni-outbox-settled: s1-02-fun-line-refusal-shape -->

## s1-02-fun-line-refusal-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-fun-line-refusal-shape
prd: 50
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When the command that raises an item is handed an intro or a punchline that breaks the rules, how should it say so?

## The decision, in plain words

It refuses at once with a one-line error naming the field, the way it refuses any other bad field, and writes nothing. In its structured mode that is an error line rather than the structured answer a badly worded question gets.

## The options, in plain words

A. Refuse at once naming the field, as for any other bad field, the option built.
B. Refuse after drafting the item, naming the section, and answer in the structured form.
C. Name the field and answer in the structured form as well.

## What I had to decide

Where `omni item new` grades `introFun` and `punchlineFun`. Acceptance criterion 2 asks that it "names the field". The pre-write `checkItemText` pass would name the section heading (`## The intro, for fun`) and, under `--json`, print `outcome: null` with the reason on stdout. The input schema names the JSON field but, like every schema error, prints one line on stderr and nothing on stdout, `--json` or not.

## What I did meanwhile

The input schema holds each field to `funLineProblems` (a zod refinement), so the error reads `"introFun" — introFun is 125 characters long — keep it to 120 characters at most.`, exit 2, nothing written or adopted. `checkItemText` still grades the rendered item as well, as a second net. Giving one field without the other is the same kind of error, naming the missing field.

## What it costs to change later

Moving the refusal to the pre-write pass is deleting the two schema refinements and adjusting a few tests in `kit/bin/item.test.mjs`; no stored shape changes. Answering in JSON as well is a special case in `readItemInput`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a caller of `--json` (the `/omni:do-work` skill) needs a JSON answer for this refusal, or reads the stderr line as it already does for a missing field

```

<!-- /omni-outbox-settled: s1-02-fun-line-refusal-shape -->

<!-- omni-outbox-settled: s2-01-answered-question-frees-its-line -->

## s2-01-answered-question-frees-its-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-answered-question-frees-its-line
prd: 50
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When an answered question leaves the list, should it keep holding its fallback intro and punchline, so that no later question's lines ever change?

## The decision, in plain words

Only the questions still shown hold a fallback line. When an earlier question is answered, a later one that had to skip past its line may move to it, so that later question's lines change once.

## The options, in plain words

A. Only the questions still shown hold a fallback line, so no line repeats in the comment while the pool has one unused, the option built.
B. Every question ever numbered keeps its fallback line after it is answered, so no line ever moves, at the price of repeats once a pull request has asked more questions than the pool has lines.

## What I had to decide

Which questions take a line from the fallback pool. The spec's decision 5 says each question skips "a line an earlier question in the same comment already took", and also that "rewriting the comment never changes a question's lines". An answered question leaves the open and adopted sections for the Answered section, which shows no lines: under the first rule it no longer takes one, so a later question that had skipped past its line may move to it, which the second rule seems to forbid. Acceptance criterion 5 names only two renders of the same comment and adding a question.

## What I did meanwhile

`questionBanter` in `kit/lib/outbox/comment.mjs` serves only the questions the comment shows (open and adopted), in question-number order, through `assignBanter` in `kit/lib/outbox/banter.mjs`. Rendering twice, rewriting in place and adding a question never change a line; an answer can change the fallback lines of a later question whose id hashed to the same line as the answered one.

## What it costs to change later

Switching to B is one change in `questionBanter`: serve every id the numbering marker lists (it already records every number ever assigned) and show only the shown questions' lines, plus a test. No stored shape changes, since the lines are recomputed on every rewrite; the switch itself moves some fallback lines once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a question that was answered, and so left the open and adopted sections, still counts as "in the same comment" when the fallback lines are handed out

```

<!-- /omni-outbox-settled: s2-01-answered-question-frees-its-line -->

<!-- omni-outbox-settled: s3-01-installed-not-terraformed -->

## s3-01-installed-not-terraformed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-installed-not-terraformed
prd: 50
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

Should the guide the agent follows to build a slice stop saying a repository is terraformed, since that word also belongs to the game and the guide must name none?

## The decision, in plain words

That guide now says the kit is not installed in this repository, in place of saying the repository is not terraformed. The other guides, and the kit's own error message, still use the old word.

## The options, in plain words

A. Reword only this guide's line, so it holds no word from the game, the option built.
B. Keep the old word here, as the kit's own name for a repository with the loop installed.
C. Reword it in every guide and in the kit's error message too, as a follow-up.

## What I had to decide

Whether to reword the one Step 0 line of `kit/plugin/skills/do-work/SKILL.md` that said "the repository is not terraformed". The plan's done-when for s3 asks that this SKILL.md name no game word, and the wave's brief lists "terraform" among the game words. Yet the kit uses "terraformed" as its own word for a repository the loop is installed in: PRD 3's spec (§3, "The footprint in a terraformed repository"), the missing-config error in `kit/lib/config.mjs`, and the same Step 0 line in `/omni:plan` and `/omni:brainstorm`, both outside this slice's territory. PRD 45 (knowledge forms, on its own feature branch) goes further and adds an `/omni:terraform` skill and a `branches.terraform` key.

## What I did meanwhile

Step 0 of `/omni:do-work` now reads "the Omni Loop kit is not installed in this repository", the wording `omni init` uses for itself. Nothing else changed: `/omni:plan` and `/omni:brainstorm` still say "not terraformed", so the three Step 0 lines no longer match. Recorded in `kit/porting/plugin--do-work.md`.

## What it costs to change later

Putting the word back is a one-line revert of prose; no stored shape, no test. Rewording the other two skills and the config error instead is a small follow-up across three files plus any test asserting that message. PRD 45 also changes `kit/plugin/skills/do-work/`, and naming `/omni:terraform` there would bring the word back, so whichever PRD ships second settles it when it merges `main`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the kit's own word for an installed repository counts as a word from the game, since PRD 3 names the principle but lists no words
- whether PRD 45's new skill name makes the word part of the kit's vocabulary rather than the game's

```

<!-- /omni-outbox-settled: s3-01-installed-not-terraformed -->
