# Settled outbox items — PRD 142

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-closed-session-found-on-post -->

## s1-01-closed-session-found-on-post — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1
- Stays here: A small pre-hook behaviour choice, cheap to change and adopted without approval. No principle or lasting rule depends on it, so it stays in the ledger.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-closed-session-found-on-post
prd: 142
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

When a terminal's page was closed while that terminal was not asking anything, what should happen to its next question?

## The decision, in plain words

That next question shows in the terminal, and the terminal forgets its closed page, so the question after it opens a fresh tab.

## The intro, for fun

A tab can be closed while its terminal is busy doing something else.

## The punchline, for fun

The terminal notices on its next question, and starts a new tab after that.

## The options, in plain words

A. The question goes to the terminal and the next opens a new tab (built).
B. Open a new tab at once and post this same question there.

## What I had to decide

Whether a question that finds its terminal's page closed goes to the terminal, or opens a fresh tab at once and waits there.

## What I did meanwhile

The question goes to the terminal; the terminal forgets its closed page; the next question opens a new tab.

## What it costs to change later

One question goes to the terminal instead of the page. Changing it is a few lines in the pre hook.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec covers a page closed while a question waits, not one closed between questions; this follows the same rule (author).

```

<!-- /omni-outbox-settled: s1-01-closed-session-found-on-post -->

<!-- omni-outbox-settled: s2-01-tab-switch-drops-draft -->

## s2-01-tab-switch-drops-draft — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 1
- Stays here: A local page-behaviour choice, cheap to change in the page component alone, with no stored data. No principle or rule needs it kept.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-tab-switch-drops-draft
prd: 142
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

When a person has started answering in one terminal's tab and then opens another tab, should the page keep their unfinished answer?

## The decision, in plain words

Opening another tab loads that terminal's page fresh, so an answer started but not sent in the first tab is lost and must be picked again on return.

## The intro, for fun

Two terminals, one half-written answer, and a person who wandered off to check the other tab.

## The punchline, for fun

The page has the memory of a goldfish for unsent answers, for now.

## The options, in plain words

A. Switching tabs starts the other terminal fresh; an unsent answer is dropped (built).
B. Keep each tab's unsent picks in the browser while the page stays open.
C. Ask before leaving a tab with unsent picks.

## What I had to decide

Whether an unsent answer must survive a switch to another tab and back.

## What I did meanwhile

Picking a tab opens that terminal's own address; the pane starts from what the database holds, with no picks made.

## What it costs to change later

Keeping the picks means holding every visited tab's draft in the browser: a change to the page component only, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often a person switches tabs mid-answer is unknown (author).

```

<!-- /omni-outbox-settled: s2-01-tab-switch-drops-draft -->

<!-- omni-outbox-settled: s2-02-empty-page-picks-nothing -->

## s2-02-empty-page-picks-nothing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 1
- Stays here: A local UI choice, adopted without approval and cheap to reverse (one line, no stored data). No existing principle or rule depends on it, so there is nothing lasting to record.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-empty-page-picks-nothing
prd: 142
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

When the page opened with no terminal asking and a first terminal then shows up, should the page select it on its own?

## The decision, in plain words

The new terminal appears in the list with its badge, and the page asks the person to pick it; nothing is selected for them.

## The intro, for fun

The page sat empty, then a terminal knocked.

## The punchline, for fun

It waves from the list and waits to be picked, like a well-mannered guest.

## The options, in plain words

A. Show the new tab and let the person pick it (built).
B. Select the first tab that arrives when nothing is selected yet, and never switch after that.

## What I had to decide

Whether the page may select a tab by itself when nothing is selected yet.

## What I did meanwhile

A page opened empty keeps reading the list; tabs that arrive show with their badge, and the pane says to pick one.

## What it costs to change later

Selecting the first arrival instead is one line in the page's state rule, with no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the page never switches tabs by itself; whether that covers a page with nothing selected is not said (author).

```

<!-- /omni-outbox-settled: s2-02-empty-page-picks-nothing -->

<!-- omni-outbox-settled: s3-01-live-proof-two-terminals -->

## s3-01-live-proof-two-terminals — agreed

- Verdict: agreed
- Approved by: pierre-derval
- Approved at: 2026-09-26
- Channel: feature pull request #145
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/145#issuecomment-5847334386
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: human-action
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 2
- Stays here: A one-off verification choice for this slice with nothing lasting to keep; it changes no code, rule or design.

### The answer, as it was given

```text
Skip the live two-terminal proof on the preview: it sits behind Vercel's deployment protection, so the kit cannot reach it. The automated tests and the demo checks in Chrome stand in; the live check runs on production after the feature PR merges, by using ask mode with two terminals, and a failure there becomes a follow-up fix.
```

### The item, as it was raised

```text
---
id: s3-01-live-proof-two-terminals
prd: 142
slice: s3
rank: human-action
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Does the tabbed page really work with two real terminals asking at once, each answered in its own tab?

## The decision, in plain words

The phone layout is built and tested, but the real-world check needs a person: two terminals open, signed in on the page, answering each one.

## The intro, for fun

Two terminals walk into one page and each wants its own answer.

## The punchline, for fun

Only a person with two hands and one browser can referee this one.

## What a person must do

1. Open the preview deployment of the feature branch and sign in on its ask page.
2. In one checkout, point ask mode at that preview and switch it on, then open two Claude Code terminals there.
3. Have each terminal ask a question; check both show as tabs and that each answer reaches its own terminal.
4. Close one terminal; check its tab is gone on the next poll.
5. On a phone, or a window narrower than 720 px, open the folded list, pick a tab and answer there.
6. Record what you saw on the slice's pull request.

## What I had to decide

Whether the page and the terminals behave together as promised, proven live on the feature's preview deployment.

## What I did meanwhile

The folded tab list for phones is built, tested, and checked in a browser on the demo page at phone and desktop widths. The live proof is left for a person.

## What it costs to change later

Nothing to undo: this is a check, not a change. If it fails, the failure becomes a fix on the feature branch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the feature branch's preview deployment is up and signed-in reads work there was not checked (author).
- Running two interactive terminals and answering on the page as the signed-in person is not something an agent can do on the person's behalf (author).

```

<!-- /omni-outbox-settled: s3-01-live-proof-two-terminals -->
