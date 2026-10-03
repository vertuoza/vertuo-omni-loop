---
id: s5-02-malformed-ids-fail-where-read
prd: 1049
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 4
---

## The question, in plain words

Now that the tool knows the exact shape of each kind of identifier, what should it do when a file or a command gives one in the wrong shape?

## The decision, in plain words

Where a person or an agent wrote the value (a plan table, a decision file, a command's argument), the tool now refuses it and names it. Where the tool reads back what it wrote itself (the answers ledger, its own hidden numbering, a folder named 0000), a wrong value is skipped as if absent.

## The intro, for fun

An identifier spelled S1 used to sneak through and fail three rooms later.

## The punchline, for fun

Now it is stopped at the door, politely, with its name read out loud.

## The options, in plain words

A. Refuse what a person or an agent wrote, by name; skip what the kit reads back of its own (built).
B. Refuse every malformed value everywhere, the ledger and the hidden numbering included.
C. Skip every malformed value everywhere, refusing nothing.

## What I had to decide

How each entry parser treats a value its brand refuses: throw (or a usage error) naming it, or read it as absent.

## What I did meanwhile

Refused by name: a plan table id or blocker that is no slice id (parsePlanSlices throws), an outbox item or account whose id or slice is malformed (front matter error), omni item new --slice that is no slice or gives no item id (usage error), a branches.rework template that names no lower-case slice (reworkSliceId throws). Read as absent: a settled.md entry whose id is no item id, a numbering-marker entry whose id is no item id, a PRD folder or knowledge source naming PRD 0, a release note whose prd is 0, a slice branch whose {slice} is no slice id (the status line shows no slice). Every id in this repository's own delivery folder reads as before; the command tests pass unchanged but for how they build values.

## What it costs to change later

Turning any refusal into a skip, or the reverse, is a safeParse versus parse swap at the one reader concerned; nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a malformed slice or item id fails where it is read, but not whether reading back the kit's own ledger and hidden markers should stop on one; skipping there keeps old ledgers and comments readable.
