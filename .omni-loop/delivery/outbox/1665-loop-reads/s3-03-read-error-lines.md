---
id: s3-03-read-error-lines
prd: 1665
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The spec names six lines a read can stop on, but a few cases it does not name came up, and the board needs to know which refusals stop everything and which stop one repository only. What should those say and do?

## The decision, in plain words

A refusal that concerns one repository marks only that repository's work unreadable; no sign-in, no answer, or a page without these reads stops the whole board. Three unnamed cases got a plain line of their own, and the page's own words are printed when it gives some.

## The intro, for fun

Six warning signs were painted; the road turned out to have nine bends.

## The punchline, for fun

The extra bends got plain signs in the same paint.

## The options, in plain words

A. Keep the lines and scopes as built.
B. Print the kit token's own refusal line instead of the no sign-in line when a kit token is in use.
C. Make every refusal stop the whole board, as a missing gh did.

## What I had to decide

Lines and scopes the spec does not settle, in kit/lib/loop-reads/omni.ts: 403, 424, 429, and a 404 carrying the page's words (a missing change, settled item s1-03) hold one repository; 401, no sign-in, a timeout or no network, and a bare 404 hold everything (exit 1). The page's {error} is printed after 'refused (<status>): ' without its closing full stop; without one, the spec's words. Unnamed: no ask.url prints 'no Omni page is set here (ask.url)' (as the approval reader says); another status prints 'refused (<status>): <words, or: the Omni page answered <status>>'; an answer the contract does not read prints 'the Omni page answered outside the loop's contract (<path>)'. A kit-token exchange refused (401) prints 'no sign-in (omni signin)', not the token's own line. The reads go through a new askClient method, readLoop (kit/lib/ask/client.ts, outside s3's territory).
Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Built and tested each line through the adapter with an injected fetch, and through omni board's main().

## What it costs to change later

A constant or a status set in omni.ts and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) With OMNI_TOKEN set, an expired or revoked kit token now prints the generic no sign-in line, losing the token's own clearer line.
- (author) Whether a 404 with the page's words should hold one repository or everything was judged from s1-03 alone.
