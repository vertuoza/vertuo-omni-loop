---
id: s2-01-knowledge-test-law-proof
prd: 2346
slice: s2
rank: high
bears-on: BR-PRODUCT-95
raised: 2026-10-21
wave: 2
---

## The question, in plain words

The knowledge check's test file also proves a locked rule, and this slice replaced one of its expectations: a locked law with no list of paths is now accepted instead of refused, as the spec asks. Are you fine with that file changing?

## The decision, in plain words

The spec says a locked law no longer needs a list of paths, so the old expectation that refused one became one that accepts it. The new tests for layers and decision tags sit in the same file, and the rule's own assertions are untouched.

## The intro, for fun

A law lost its mandatory address, so the test that demanded one had to move on.

## The punchline, for fun

The check now asks where a law lives only if it knows.

## The options, in plain words

A. A. Keep the new tests and the changed expectation in the existing knowledge check test file (built).
B. B. Move the new tests to a file of their own and keep only the changed expectation in the existing file.

## What I had to decide

Keep the new tests and the one changed expectation in the existing knowledge check test file; the proof of the locked rule itself is untouched.

Decided by: Jev (hardToRevert 0.56) · agent said true

## What I did meanwhile

A locked law with no path list passes the knowledge check and is global or reached through its domain or layers.

## What it costs to change later

Moving the new tests to a file of their own is a small edit; restoring the old refusal is one expectation and one check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner wants the new tests beside the rule's proof or apart from it (author)
