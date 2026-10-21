---
id: s1-01-baseline-skips-names-only
prd: 2305
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

While the old files are being cleaned, should the list of files still waiting for their cleanup also excuse them from the secret check, or only from the internal-names check?

## The decision, in plain words

A file on that waiting list is excused from the internal-names and real-email checks only. It is still checked for secrets, like every other file.

## The intro, for fun

A waiting list is a fine place to wait, not to hide a key.

## The punchline, for fun

The names get a grace period; the secrets never did.

## The options, in plain words

A. A. The waiting list excuses the internal-names and real-email checks only; secrets are checked everywhere (built).
B. B. The waiting list excuses a file from every check, secrets included, as the plan's words read.

## What I had to decide

Keep A unless a waiting file needs to hold a secret-shaped value that cannot go on the allowlist; then B, by dropping the secret rule's baseline check in the guard's scan step (one line).

## What I did meanwhile

Every file the guard reads is checked for secrets; the visible fakes in today's tests are on the allowlist with their reasons, so the guard is green on the feature branch.

## What it costs to change later

A constant: one condition in the guard's scan. The waiting list goes away with the last slice either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's done-when says a listed file is not judged at all; this reads it as not judged for internal names, the thing the list was made for (author).
