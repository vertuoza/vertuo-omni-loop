# Settled outbox items — PRD 262

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-example-notes-invented-product -->

## s1-01-example-notes-invented-product — adopted

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

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-example-notes-invented-product
prd: 262
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The playbook page on releasing shows three example release notes. Should they describe an invented product, or this project's own releases?

## The decision, in plain words

They describe an invented product with reports, invoices and search, because every repository that runs the loop reads this page, not only ours.

## The intro, for fun

Every style guide needs a few examples, and someone has to decide whose story they tell.

## The punchline, for fun

The invented product never ships late, which makes it a very patient example.

## The options, in plain words

A. Examples about an invented product, so any repository reads them as neutral: the option built.
B. Three of this project's own initial release lines, the voice it actually ships.
C. No examples at all, only the rules.

## What I had to decide

What the three example notes in the kit default of the `releasing` form's `notes` slot describe. The spec asks for "the rules above with three example notes" and does not say which product they are about.

## What I did meanwhile

Three notes about an invented product: a public link to a report, invoices in the customer's language, and search as you type. Each parses and passes `omni check releases` (`kit/lib/playbook/releasing.test.mjs`).

## What it costs to change later

One template section and its test: swap the three fenced examples, rebuild the bundle with `pnpm kit:build`. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the reviewer would rather the kit default carry this repository's own voice (three of the initial release's lines), which every other repository running the loop would then read as its playbook's example.

```

<!-- /omni-outbox-settled: s1-01-example-notes-invented-product -->

<!-- omni-outbox-settled: s1-02-prd-number-in-title-any-case -->

## s1-02-prd-number-in-title-any-case — adopted

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

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-prd-number-in-title-any-case
prd: 262
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

A release note's title may not name a PRD number. Should the check also refuse one written in lowercase, or with no space before its digits?

## The decision, in plain words

Yes: the check refuses a PRD number however it is written, since the page already shows the number beside every title.

## The intro, for fun

A rule against numbers in titles soon meets a title that whispers its number in lowercase.

## The punchline, for fun

The check hears whispers too, so the number stays out of the headline.

## The options, in plain words

A. Refuse a PRD number in any case, with or without a space: the option built.
B. Refuse only the capitalised form with a space, exactly as the spec writes it.

## What I had to decide

How strictly rule 4 reads "does not match `PRD <digits>`": the spec writes the form in capitals with a space, and does not say whether `prd 7` or `PRD12` count.

## What I did meanwhile

The title rule matches `PRD` in any case, then optional whitespace, then digits, at a word boundary (`/\bPRD\s*\d+/i` in `kit/lib/releases/note.mjs`). Tests pin `PRD 12`, `prd 7` and `PRD12` as refused and `PRDs` as fine.

## What it costs to change later

One regular expression and its test lines; no stored data. A note that passes today still passes under the narrower reading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a product name could legitimately read as PRD followed by a number in a title; none is known here.

```

<!-- /omni-outbox-settled: s1-02-prd-number-in-title-any-case -->
