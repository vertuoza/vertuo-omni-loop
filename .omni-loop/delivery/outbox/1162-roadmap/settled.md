# Settled outbox items — PRD 1162

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-roadmap-push-shape -->

## s2-01-roadmap-push-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-roadmap-push-shape
prd: 1162
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

The spec lists what a stored roadmap holds, but not its open questions, how a waiting PRD names what it waits on, or what a PRD whose work was closed without merging looks like. What should the app keep?

## The decision, in plain words

The app keeps each roadmap's open questions with any answer given, so the page can show them and the answer box; a waiting PRD keeps one line naming what it waits on plus its link; and a PRD can be marked closed, beside waiting, building, outbox, ready for a merge and merged.

## The intro, for fun

A roadmap walks into a database and asks for a table for its questions.

## The punchline, for fun

The database said yes, and kept a seat for the answers too.

## The options, in plain words

A. A. Store the questions with their answers on the roadmap, waits-on as a line and a link, and six states including closed (built).
B. B. Store no questions; the page reads them from the stored roadmap document and the answers from the roadmap's issue.
C. C. Keep the spec's five states and show a PRD closed unmerged as waiting, its line saying why.

## What I had to decide

Whether the stored roadmap carries its questions and answers, and whether `closed` is a state of its own.

## What I did meanwhile

The page (s5) and `omni roadmap push` (s6) build against this shape: `questions` on the roadmap, `waitsOn` and `waitsOnUrl` on each PRD, and six states.

## What it costs to change later

Changing it later is one migration on two tables nothing else reads, and the matching edits in the API's schema, s5's page and s6's push.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the page needs the phase's done-when line beside the milestone: the front matter has no field for it, so nothing stores it. (author)

```

<!-- /omni-outbox-settled: s2-01-roadmap-push-shape -->

<!-- omni-outbox-settled: s2-02-roadmap-any-member-pushes -->

## s2-02-roadmap-any-member-pushes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-roadmap-any-member-pushes
prd: 1162
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

A loop on the Omni page belongs to the person who runs it, and only they can update it. Should a roadmap work the same way, or belong to the whole workspace?

## The decision, in plain words

A roadmap belongs to its workspace: any member can update it, and the last person who did is recorded. Two people driving the same roadmap both keep its page current.

## The intro, for fun

Whose roadmap is it anyway? Everyone's, as it turns out.

## The punchline, for fun

The page just remembers who touched it last.

## The options, in plain words

A. A. Any member of the workspace updates it; the last pusher is recorded (built).
B. B. Only the person who first sent it updates it; anyone else is refused, as a loop is.

## What I had to decide

Whether any member of the workspace may update a roadmap, or only the person who first sent it.

## What I did meanwhile

Any member's `omni roadmap push` replaces the roadmap's document and PRD rows; the row keeps `pushed_by`.

## What it costs to change later

Restricting it later is one change to the database function, and a refusal the push command learns to print.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only roadmap_push() writes and members read; it does not say who among the members may push. (author)

```

<!-- /omni-outbox-settled: s2-02-roadmap-any-member-pushes -->
