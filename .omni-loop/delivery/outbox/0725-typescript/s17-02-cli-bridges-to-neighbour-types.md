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

A few library parts the command line calls are still untyped, or typed a little narrower than what really reaches them. Should the command line bridge those gaps with marked shortcuts for now?

## The decision, in plain words

The command line bridges each gap with a shortcut marked on its own line and its reason, and nothing it does changes. Each shortcut becomes useless once the part it calls is typed or widened, and the final tightening can remove it.

## The intro, for fun

The new road reached the old bridge, and the old bridge is one lane narrower.

## The punchline, for fun

A cone and a sign do the job until the bridge crew arrives.

## The options, in plain words

A. A: keep the marked bridges now; s18 and the final tightening slice remove them
B. B: widen the neighbouring library types in their own follow-up pull request before the ratchet
C. C: wait for s18 to merge and rebase this slice to drop the update and statusline bridges

## What I had to decide

How the typed CLI calls lib/update and lib/statusline (still @ts-nocheck until s18), and library functions whose types are narrower than the values they are handed today.

## What I did meanwhile

Marked casts (// ts-allow) in commands/update.ts (findTarget `to`, updatePlugin `version`) and commands/statusline.ts (readFacts `spawn`) for the s18 modules; commands/rework.ts passes a null feature branch to planRework, typed string; commands/proof.ts hands the ask client to pushProof, whose upload takes Uint8Array where the client's takes BodyInit; commands/board.ts reads plan slices whose wave may be null as the board's number; commands/plan.ts keeps the slug-less plan repository crash of s10-01; commands/replies.ts reads the posted comment readReplies types unknown.

## What it costs to change later

Each bridge is one line to delete once its neighbour is typed (s18 for update and statusline) or widened (policy/rework featureBranch, proof/push upload, board wave, replies posted).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether planRework should take a null feature branch in its type, or the CLI should refuse one, is a behaviour question this slice may not settle
