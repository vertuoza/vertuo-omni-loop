---
id: s3-01-ready-membership-client-call
prd: 3194
slice: s3
rank: medium
bears-on: none
raised: 2026-11-23
wave: 2
---

## The question, in plain words

The page call that tells which missions name a PRD did not exist yet in the shared client, and the slice's territory did not list that file. Was it right to add it there?

## The decision, in plain words

I added the one small call to the shared client file and made the ready command start from the page, so a missing sign-in or an unreachable page holds the check instead of saying a PRD is in no mission.

## The intro, for fun

A reader needed a phone number nobody had written in the book.

## The punchline, for fun

So the number went in the book, one line, beside the others.

## The options, in plain words

A. A. Add the call to the shared client file, as built.
B. B. Keep the shared client untouched and make the call from the membership file with its own fetch.

## What I had to decide

Added `missionsOfPrd` to `kit/lib/ask/client.ts` (outside s3's territory; the brief said it was already there, but slice s2 only added `getMission`). Turned `omni ready` into a command that loads its own context, as `omni mission` does, so tests can hand it a sign-in and a fetch. When the page is off, signed out, unreachable or refuses, it prints `mission membership not read: <why>` and exits 1, after the pull request is found and before the verdict.

## What I did meanwhile

Nothing waits on this; the call is a read of a route that already exists.

## What it costs to change later

If a person prefers the call elsewhere, moving one method is a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The brief said the client already had the call; it did not (author).
