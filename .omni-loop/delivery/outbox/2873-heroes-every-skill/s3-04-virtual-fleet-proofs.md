---
id: s3-04-virtual-fleet-proofs
prd: 2873
slice: s3
rank: medium
bears-on: BR-GAME-2
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The checks that prove three rules of virtual fleets had to follow the sixth role: is it right that they now count six heroes and name the Designer, with every rule still checked as before?

## The decision, in plain words

Yes: the checks now make a fleet of six heroes, expect the Engineer's full list of skills and use a made-up role where they used the Designer as the unknown one. What each rule asks is checked exactly as before.

## The intro, for fun

The rules about virtual fleets did not change, but the fleets got one more seat.

## The punchline, for fun

Same referee, same rules, one more player on the bench.

## The options, in plain words

A. Keep the checks as updated for six roles (built).
B. Leave the Designer out of the checks and keep the old counts, proving the sixth role elsewhere.

## What I had to decide

Approve the updated checks, or ask for the old counts back with the Designer left out of the checks.

## What I did meanwhile

Built A: supabase/checks/virtual_fleets.sql (BR-GAME-1, BR-GAME-2, BR-GAME-3) and apps/galaxy/src/virtual-fleets/virtual-fleets.controller.test.ts (BR-GAME-2) follow the six roles; the name, cap, owner-only, one-hero-per-role, last-hero and no-player checks are unchanged. The check also runs the s3 migration again and proves the rewrite of stored heroes.

## What it costs to change later

A constant: the counts and role lists in two test files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The three rules are proposed, not locked; the coverage guard still names their proofs as a law change, which only a person's answer clears.
