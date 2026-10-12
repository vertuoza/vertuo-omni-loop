---
id: s2-01-session-tests-beside-a-law-proof
prd: 1739
slice: s2
rank: high
bears-on: N-PRODUCT-12
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The new session id checks were added to two test files that also prove the rule that the 'what am I on now' command never refuses outside an installed folder. Is it fine that those files now carry more than that rule's proof?

## The decision, in plain words

Yes: the rule itself is untouched and still proven by the same checks. The files only gained new checks for the session id, and the command still reads nothing and answers 'on nothing' outside an installed folder.

## The intro, for fun

Two test files guard a rule, and now they guard a little more.

## The punchline, for fun

Same guard dogs, one extra fence to watch.

## The options, in plain words

A. A. Keep the new session checks in the files that already test these commands, beside the rule's proof (built).
B. B. Move the new session checks to a separate test file, so the rule's proof files stay as they were.

## What I had to decide

Confirm the rule's proof stands as it is, or ask for the new session checks to move to a test file of their own.

## What I did meanwhile

The new checks sit in the same files as the rule's proof; the rule's own checks are unchanged and green.

## What it costs to change later

Moving the new checks to their own file later is a small test-only change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the coverage guard flags any change to a file that proves a law, and these two files only gained new tests (author).
