---
prd: 50
title: A joke around every outbox question — an intro and a punchline
blocked-by: none
spec: file
---

# A joke around every outbox question

**Date:** 2026-09-25 · **PRD:** #50 · **Follows:** #28 (the omni-loop App posts the outbox comment),
#7 (`/omni:do-work` raises the items) · **Touches:** the outbox comment formatter
(`kit/lib/outbox/comment.mjs`), the item format (`kit/lib/outbox/outbox.mjs`)

## Problem

The outbox comment on a feature pull request is where a person meets the agent's decisions, and every
question in it reads the same: a separator, a heading, the quoted question, a table of options. A person
going through a dozen of them skims, and the comment reads like a tax form. The loop already plays a
game on top of delivery, yet the one page a person reads question by question has no voice.

## Solution

Every question block in the pull request's outbox comment, open or adopted, gets two short lines in
italics: an **intro** under its heading, before the quoted question, and a **punchline** after the
question, before its options.

```markdown
---

### Question 1 · medium — adopted

_A planet with no forms is just a very expensive rock._

> Should the one-line install also create the empty knowledge forms, and end by telling people how to
> fill them?

_OmniMan votes yes. OmniMan always votes yes._

|   | Option | |
| --- | --- | --- |
| A | The install writes the blank forms after the config and the bin, … | ✅ adopted · built |
```

### Who writes the lines

- **The agent that raises the item** writes both, about that question. An item gains two optional
  sections, `## The intro, for fun` and `## The punchline, for fun`, together or neither, right after the
  two plain-words sections and before the options (or the person steps). `omni item new` takes them as
  `introFun` and `punchlineFun`.
- **The kit's fallback pool** covers every item without them: one raised before this PRD, or an adopted
  entry whose embedded item predates it (the settled ledger is append-only, so those never gain the
  sections). The comment picks an intro and a punchline from the pool by a stable hash of the item's
  id.

### What a line may say

- One sentence, at most 120 characters, in plain words: the same `plainWordsProblems` rules as the
  question and the decision (no code name, path or id).
- About the question or its situation. Never about a person or a team, and never mocking whoever
  answers.
- An agent's line may name anything in the repository's world, the game included. The kit's fallback
  pool never names the game (PRD 3, §2, principle 7: the kit never mentions the game).

### Where the lines show

In the pull request's outbox comment, in every open question block (`human-action`, high and medium,
with options, person steps or the older decision line) and every block in the **Adopted unless you
object** section. Not in the **Answered** section, the PRD issue's outbox comment or the Slack note.

## Decisions

Decisions 1 to 3 were chosen by the PRD author on 2026-09-25. The rest follow from them.

1. **Placement:** the intro sits between the question's heading and the quoted question, and the
   punchline sits between the quoted question and its options, person steps or decision line.
2. **Author:** the agent writes both lines for every item it raises, and the kit's pool fills in for an
   item without them.
3. **Its own PRD,** apart from PRD 45 (knowledge forms).
4. **Optional in the item format, always in the comment.** The parser and the guard accept an item
   without the pair, because older open items and every settled entry must keep parsing. The comment
   is never without the lines, because the pool fills in.
5. **Stable fallback lines.** The comment serves questions in number order. Each takes the pool line
   its id hashes to, skipping a line an earlier question in the same comment already took. Rewriting
   the comment never changes a question's lines, and a new question never changes an older one's.
6. **The pool never names the game,** and a test lists the words it may not hold.
7. **No item raised while building this PRD carries the new sections.** The omni-loop App evaluates
   with the kit on `main`, whose parser refuses an unknown heading. Until this PRD merges, an item with
   the sections on its feature branch would fail the App's check. `/omni:do-work` learns to write them
   in this PRD's last wave, and it takes effect once the PRD is merged.

## User stories

- As a **person answering on a feature PR**, each question opens with a line that makes me smile and
  tells me what it is about, before I read the options.
- As **an agent raising an item**, I write two short lines about my own question, and `omni item new`
  tells me when one is not plain words or is too long.
- As **a repository whose older items have no lines**, every question in my comment still gets a pair,
  and the pair does not change each time the comment is rewritten.

## Scope

**In:** the item parser and renderer; `omni item new`; the outbox guard (`omni check outbox`); the pull
request comment formatter, for open and adopted questions; the fallback pool; `/omni:do-work`'s step that
raises an item; the porting records of every ported file this changes; the rebuilt `kit/dist/omni.mjs`.

**Out:** the PRD issue's outbox comment, the Slack note and the **Answered** section; making the lines
required; translating them; anything in the galaxy.

**Human steps:** none. The omni-loop App redeploys from `main` when the feature pull request merges, as it
does today.

## Test seams

All in the root vitest suite (`pnpm test`):

- **The parser:** an item with the pair right after its plain sections parses and exposes
  `sections.introFun` and `sections.punchlineFun`; one with only one of them, or with them anywhere else,
  is refused naming the file; an item with neither parses as before.
- **`omni item new`:** through `main()`, with and without the two fields, with `--adopt`, and with a
  line that breaks a rule.
- **The guard:** `checkItemText` on open items whose lines break a rule.
- **The comment:** `formatOutboxPrComment` for each question layout, the fallback, two rewrites, a hash
  collision and a new question.
- **The pool:** a test that it holds none of the game words it lists, and `kit/test/no-literals.test.mjs`.
- **The skill:** `kit/test/plugin.test.mjs`.
- **The bundle:** `kit/test/dist.test.mjs`.

## Risks

- **A line lands badly.** The rules and the review of each pull request catch most. An adopted item's
  lines are kept in the append-only ledger, so a bad one stays in the collapsed section; the only remedy
  is a person's objection, and it is accepted.
- **A longer comment.** Two italic sentences per question add some length. At most 120 characters each
  keeps it bounded.
- **Rollout order.** The App and every installed bin run `main`'s kit. Decision 7 keeps this PRD's own
  items clear of the new sections until it merges.
- **Shared ground with PRD 45.** Both change `kit/lib/outbox/check-outbox`, `kit/plugin/skills/do-work/`
  and `kit/dist/omni.mjs`. Whichever ships second merges `main` into its feature branch and rebuilds the
  bundle.

## Acceptance criteria

1. An item file carrying `## The intro, for fun` and `## The punchline, for fun` right after its two
   plain sections parses, with `sections.introFun` and `sections.punchlineFun`. One carrying only one of
   them, or carrying them in another place, is refused naming the file. An item carrying neither parses
   as before.
2. `omni item new` given `introFun` and `punchlineFun` writes both sections. Given a line over 120
   characters or holding a backticked code name, it exits 2, writes nothing and names the field. With
   `--adopt`, the settled entry embeds both sections.
3. `omni check outbox` fails an open item whose intro or punchline breaks the plain-words rules or the
   length, naming the file.
4. In the pull request's outbox comment, every open question and every adopted question reads, in this
   order: the separator, the heading, the intro in italics, the quoted question, the punchline in
   italics, then its options table, person steps or decision line.
5. A question whose item has no pair gets an intro and a punchline from the kit's pool. Rendering the
   comment twice gives the same lines. No pool line repeats within one comment while the pool has unused
   lines, and adding a question never changes an earlier question's lines.
6. The pool holds none of the game words its test lists, and `kit/test/no-literals.test.mjs` passes.
7. `/omni:do-work` tells the agent to write both lines for every item it raises, with the rules above, and
   `kit/test/plugin.test.mjs` passes.
8. `kit/dist/omni.mjs` equals a fresh build (`kit/test/dist.test.mjs`), and `pnpm test` is green.
