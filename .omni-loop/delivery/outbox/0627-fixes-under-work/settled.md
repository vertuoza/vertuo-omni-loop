# Settled outbox items — PRD 627

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-rounds-kept-once-by-content -->

## s1-01-rounds-kept-once-by-content — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-rounds-kept-once-by-content
prd: 627
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When a visual fix is sent to the Omni page again, how does the page know which rounds of looks it already holds?

## The decision, in plain words

A round is kept once: sending the same round again adds nothing, and a new round is added after the others. A round whose content changed after it was shown would be added as a new round.

## The intro, for fun

Five looks, three rounds, one page that must not count them twice.

## The punchline, for fun

Déjà vu is skipped; only new looks get a seat.

## The options, in plain words

A. Recognise a round by its content: an identical round adds nothing, anything else is a new round (built).
B. Store the round number with each version, so round k is always round k and an edited round adds a version of it.
C. Send only the rounds added since the last push, and keep the version rule as it is for every kind.

## What I had to decide

Whether a round is recognised by its content (built) or by its round number.

## What I did meanwhile

Every push sends every round, oldest first; the database adds only the rounds it has never seen, so their order on the page is the order they were first sent.

## What it costs to change later

Changing it means one more column (the round number) and a rewrite of the version rule for rounds; no page changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each round is one variations version in round order, but not how a second push of the same rounds is told apart from new ones.
- (author) A round edited after it was committed shows up as an extra round rather than a new version of the same round.

```

<!-- /omni-outbox-settled: s1-01-rounds-kept-once-by-content -->

<!-- omni-outbox-settled: s1-02-push-cap-kept-at-two-mib -->

## s1-02-push-cap-kept-at-two-mib — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-push-cap-kept-at-two-mib
prd: 627
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

A visual fix now sends its before and after page and every round of looks at once. Should one send be allowed to carry more than it does today?

## The decision, in plain words

The limit on one send stays as it is today, about four big pages. A visual fix whose page and rounds together go past it is refused as a whole and the terminal says so; nothing else changes.

## The intro, for fun

Every round of looks rides in one envelope to the Omni page.

## The punchline, for fun

The envelope did not grow; most looks travel light anyway.

## The options, in plain words

A. Keep one send at 2 MiB for every kind (built).
B. Raise the limit to about 4 MiB, what the hosting accepts for one call.
C. Keep the limit and have the kit send a large fix's rounds in several sends.

## What I had to decide

Whether to raise the limit on one send for fixes (up to what the hosting takes, about 4 MiB), or split a large fix into several sends.

## What I did meanwhile

A send over the limit is refused with 'refused (413)' in the terminal and the fix's page is not updated; each page stays under its own 512 KiB limit as before.

## What it costs to change later

Raising it is one constant in the page's server and one in its tests; splitting sends is a small change in the kit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No real visual fix has sent more than one round yet, so how large rounds get in practice is not known.

```

<!-- /omni-outbox-settled: s1-02-push-cap-kept-at-two-mib -->
