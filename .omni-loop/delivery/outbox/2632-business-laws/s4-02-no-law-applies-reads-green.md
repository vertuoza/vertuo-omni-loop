---
id: s4-02-no-law-applies-reads-green
prd: 2632
slice: s4
rank: medium
bears-on: none
raised: 2026-11-04
wave: 3
---

## The question, in plain words

When the product has business laws but none of them applies to a spec (its words point to no domain, and the product has no law that applies everywhere), should the PRD page call that a pass or say it was not judged?

## The decision, in plain words

It is a pass: the page says the business laws passed with none judged, adds that no business law applies to this spec, and Approve stays on. The model is not asked, and the verdict is kept like any other.

## The intro, for fun

The referee arrived, looked at the field, and found nobody had brought a ball.

## The punchline, for fun

So the match ended with no fouls, which is technically a clean game.

## The options, in plain words

A. A. A spec no law applies to is green, with none judged, as built.
B. B. It is neutral: the page says the business laws were not judged, and why.

## What I had to decide

Whether a spec no business law applies to is a green verdict (`Business laws ✓ 0 judged`, "No business law applies to this spec.") or a neutral one (`Business laws not judged: no business law applies to this spec`).

## What I did meanwhile

`judgeSpec` (apps/galaxy/src/business-laws/judge.service.ts) answers `green` with the reason `no business law applies to this spec` and no law judged; the verdict is kept per spec version and pack like any other, and Approve stays on either way.

## What it costs to change later

One branch of `judgeSpec` and one line of `BusinessLawsVerdict.tsx`; verdicts already kept as green stay green, being never rewritten.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a product with no law is neutral and shows nothing, and that a green says what it judged; it does not say which a spec with laws but none selected is (author).
