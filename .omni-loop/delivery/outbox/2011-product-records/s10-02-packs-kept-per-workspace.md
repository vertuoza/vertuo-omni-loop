---
id: s10-02-packs-kept-per-workspace
prd: 2011
slice: s10
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

When a repository's knowledge changes, which teams keep a copy of it, which copy counts as the latest, and how may an agent link read one?

## The decision, in plain words

Each team that has put the repository in one of its products keeps its own copy; the copy of the most recent change counts as the latest, even when an older change arrives later; an agent link reads only its own team's copies, of a repository its team lists or owns.

## The intro, for fun

Two teams, one repository, and a pile of notes that must never wander next door.

## The punchline, for fun

Everyone gets their own copy, and nobody gets the neighbour's.

## The options, in plain words

A. A. One pack per workspace holding the repository in a product, newest by commit date, agent links read their own workspace only (as built)
B. B. Also keep a pack in every workspace that merely tracks the repository
C. C. No agent-link read: packs are read only by signed-in members and kit tokens

## What I had to decide

Where a knowledge pack is kept (every workspace tracking the repository, only those holding it in a product, or one shared row), how the newest pack is chosen (by arrival or by the commit's date), and whether an agent link (a business link) gets a read of its own besides a member's signed-in read.

## What I did meanwhile

knowledge_pack_put() keeps one pack per workspace that links the repository to a product, and none where no product holds it; the newest per workspace and repository is the pack of the latest commit date, so a late webhook for an older commit never takes its place. Members read through row-level security; knowledge_pack_for_token() lets an agent link read only its own workspace's packs, refusing a repository the workspace neither lists nor owns, the same scope business_for_token() checks. supabase/checks/knowledge_packs.sql proves a link of another workspace reads none, and goes red when the workspace filter is removed.

## What it costs to change later

Small while nothing reads packs yet: a follow-up migration that changes knowledge_pack_put() or drops knowledge_pack_for_token(). Once the harvest (s11) and the kit (s12) use them, the readers change with it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a pack is the newest 'for each product link' but not whether a workspace tracking the repository outside any product should get one
- (author) The spec names tokens without saying whether agent links read packs at all; the kit reads as its signed-in member, so the agent-link read is used by nothing yet
- (author) Packs are kept for every commit that touches knowledge, with no pruning; how many to keep is not settled
