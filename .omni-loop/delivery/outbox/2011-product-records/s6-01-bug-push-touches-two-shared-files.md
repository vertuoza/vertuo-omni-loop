---
id: s6-01-bug-push-touches-two-shared-files
prd: 2011
slice: s6
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

To send a bug record to the Omni page, the command needs a call that the shared sign-in client does not have yet, and a shared helper that was private. Is it fine that this slice touched those two shared files?

## The decision, in plain words

The sign-in client gained one call for bug records, and the private line that words a failed call in the roadmap code was made shareable, so the bug command words its failures the same way. Nothing else in those files changed.

## The intro, for fun

A new road needs a sign, and the sign shop was next door.

## The punchline, for fun

Two borrowed tools, returned unchanged.

## The options, in plain words

A. A. Add the one call and share the helper, leave the help text for a later slice (as built)
B. B. Keep a private copy of the helper in the bug folder, and still add the one call
C. C. Give the bug command its own plain fetch and touch no shared file

## What I had to decide

Whether a slice may add one call to the shared client and share one private helper when its territory lists neither file.

## What I did meanwhile

Added pushBug to kit/lib/ask/client.ts, beside pushRoadmap, and exported callLine from kit/lib/roadmap/product.ts so kit/lib/bug/product.ts reuses it instead of copying it. The help text of omni bug (kit/lib/help/entries.ts) was left as it is, so omni help bug does not yet list check and push.

## What it costs to change later

A constant: moving the call or the helper into the bug folder is a few lines, with a copy of the helper there.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s6 lists neither kit/lib/ask/client.ts nor kit/lib/roadmap/product.ts nor kit/lib/help/entries.ts, yet the push needs the first, the duplication check asks for the second, and omni help would want the third.
