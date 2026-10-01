---
id: s7-02-relay-without-a-folder-names-it
prd: 725
slice: s7
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Moving a target's decisions into a feature that has no folder yet used to crash with an unclear error. Should it now stop with a message naming the feature instead?

## The decision, in plain words

It now stops with a message naming the feature. The command that moves the decisions already refuses this case first, so nobody sees the new message in practice.

## The intro, for fun

A box of decisions arrives at an address that does not exist yet.

## The punchline, for fun

The courier now says which address was missing, instead of just dropping the box.

## The options, in plain words

A. Stop with a message naming the feature that has no folder
B. Keep the unclear crash it had before
C. Create the missing folder and carry on

## What I had to decide

relayFolder (kit/lib/outbox/relay.ts) called join(ctx.root, outboxDir) with outboxDir null when the PRD had no inbox or shipped folder, which throws Node's own ERR_INVALID_ARG_TYPE. The types refuse a null there.

## What I did meanwhile

relayFolder now throws Error('PRD <n> has no inbox or shipped folder') when ctx.layout.outboxDir(prd) is null. omni item relay checks the same condition and refuses with its own usage error before ever calling relayFolder, so no output of the command changes.

## What it costs to change later

A constant: one line in one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any caller other than omni item relay calls relayFolder (author)
