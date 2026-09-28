---
id: s3-02-member-cannot-see-owner-name
prd: 400
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The fleets page tells a member who may change fleets. Should it name the owner, when a member cannot yet find out who the owner is?

## The decision, in plain words

It reads, word for word, Only @owner can change fleets. A member is not allowed to see other members' roles, so the page cannot name the owner without a new database change.

## The intro, for fun

Somebody runs the hangar, and the sign on the door just says the boss.

## The punchline, for fun

Knock anyway, the boss is probably friendly.

## The options, in plain words

A. The line reads Only @owner can change fleets. word for word (built).
B. A new database function names the owner to members, and the line reads their GitHub handle.
C. The line reads Only the workspace's owner can change fleets.

## What I had to decide

Keep the line as it is, or have the database tell members who the owner is so the page can name them.

## What I did meanwhile

The line reads Only @owner can change fleets. for every member.

## What it costs to change later

A small database function plus one line on the page, whenever the owner's name should appear.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec quotes the line with @owner, which may be the owner's handle or the word itself; members can read only their own membership, so the page could not look it up.
