---
id: s1-02-dossier-reason-on-403-only
prd: 459
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When the Omni page refuses a dossier, should the terminal show the page's explanation for every kind of refusal or only when access is refused?

## The decision, in plain words

The terminal shows the page's explanation only when access is refused; other refusals, like a file that is too large, keep their short status as before.

## The intro, for fun

A terminal that explains everything is a terminal nobody reads.

## The punchline, for fun

So it only explains the one refusal people cannot guess.

## The options, in plain words

A. Print the reason only after an access refusal, and keep every other refusal as it was.
B. Print the reason after every refusal that carries one.
C. Never print a reason, and send people to the page instead.

## What I had to decide

Whether the dossier command prints the page's reason after every refused status, or only after an access refusal.

## What I did meanwhile

An access refusal reads with its reason; every other refusal reads exactly as it did before this change.

## What it costs to change later

A constant: printing the reason for every status is one condition removed and a few expected lines updated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a too-large or malformed refusal would be clearer with its reason was not asked of anyone (author).
