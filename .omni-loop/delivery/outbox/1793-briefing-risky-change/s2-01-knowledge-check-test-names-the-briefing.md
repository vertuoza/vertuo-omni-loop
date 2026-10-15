---
id: s2-01-knowledge-check-test-names-the-briefing
prd: 1793
slice: s2
rank: high
bears-on: BR-PRODUCT-95
raised: 2026-10-15
wave: 2
---

## The question, in plain words

The test that proves one of our knowledge rules now also checks that the list of reviewers for the laws names the agents' rulebook. Is it fine to grow that test?

## The decision, in plain words

I added one case to that test: a reviewer list written before the rulebook was named is reported out of date. Every case it already had stays as it was, and the rule it proves still holds as written.

## The intro, for fun

The rulebook finally gets its own bodyguard.

## The punchline, for fun

One more line on the guest list, and the bouncer checks it.

## The options, in plain words

A. Keep the new case in the knowledge check's test, beside the other reviewer-list cases (built).
B. Move it to the kb command's test only, and leave the rule's test as it was.

## What I had to decide

Whether `kit/lib/knowledge/check-knowledge.test.ts`, the test BR-PRODUCT-95 names, may carry the new case that a CODEOWNERS block without the briefing's lines is out of date (plan s2 asks for it there). The case only adds; no assertion of the rule's own cases changed.

Decided by: Jev (hardToRevert 0.76) · agent said true

## What I did meanwhile

The slice branch carries the new case beside the other CODEOWNERS cases; the knowledge check and kb tests are green.

## What it costs to change later

Moving the case to `kit/bin/kb.test.ts` alone is a test move, a few minutes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None known: the plan's done-when for s2 names this test as the place of the case (author).
