---
id: s17-02-cli-bridges-to-neighbour-types
prd: 725
slice: s17
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

A few library parts the command line calls are typed a little narrower than what really reaches them. Should the command line bridge those gaps with marked shortcuts for now?

## The decision, in plain words

The command line bridges each gap with a shortcut marked on its own line and its reason, and nothing it does changes. Each shortcut becomes useless once the part it calls is typed or widened, and the final tightening can remove it.

## The intro, for fun

The new road reached the old bridge, and the old bridge is one lane narrower.

## The punchline, for fun

A cone and a sign do the job until the bridge crew arrives.

## The options, in plain words

A. A: keep the marked bridges now; the final tightening slice removes them
B. B: widen the neighbouring library types in their own follow-up pull request before the ratchet
C. C: have the command line refuse the values the library types leave out, such as a missing feature branch

## What I had to decide

How the typed CLI calls library functions whose types are narrower than the values they are handed today. The lib/update and lib/statusline bridges this slice first needed were dropped once s18 merged.

## What I did meanwhile

Marked casts (// ts-allow): commands/rework.ts passes a null feature branch to planRework, typed string; commands/proof.ts hands the ask client to pushProof, whose upload takes Uint8Array where the client's takes BodyInit; commands/board.ts reads plan slices whose wave may be null as the board's number; commands/plan.ts keeps the slug-less plan repository crash of s10-01; commands/replies.ts reads the posted comment readReplies types unknown.

## What it costs to change later

Each bridge is one line to delete once its neighbour is widened (policy/rework featureBranch, proof/push upload, board wave, replies posted).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether planRework should take a null feature branch in its type, or the CLI should refuse one, is a behaviour question this slice may not settle
