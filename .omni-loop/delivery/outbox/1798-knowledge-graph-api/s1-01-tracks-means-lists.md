---
id: s1-01-tracks-means-lists
prd: 1798
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

Who counts as a member of a workspace that tracks a repository, when that workspace has switched the repository's tracking off on its Engineering board?

## The decision, in plain words

Any workspace that has the repository among its repositories counts, whether its tracking is on or off. Its members may push the repository's knowledge graph and read it.

## The intro, for fun

Switching tracking off mutes the Engineering board, but does it mute the knowledge too?

## The punchline, for fun

For now the knowledge keeps talking to the team that owns the repository.

## The options, in plain words

A. A. A workspace that lists the repository counts, tracked or not (built).
B. B. Only a workspace that tracks it on the Engineering board counts.

## What I had to decide

Whether the knowledge graph follows the workspace's list of repositories (as built) or only the repositories it tracks on the Engineering board. B changes one condition in knowledge_graph_push() and the read policy of knowledge_graphs, through a follow-up migration.

## What I did meanwhile

knowledge_graph_push() and the row-level security of knowledge_graphs read public.repositories with no condition on `tracked`, as knowledge_pack_for_token() reads a repository its workspace lists (supabase/migrations/20261214090000_knowledge_graphs.sql). The check proves a member of a listing workspace pushes and reads, and a stranger does neither.

## What it costs to change later

Low: one condition in one function and one policy, in a follow-up migration. No stored row changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says tracks without saying whether the Engineering board's tracking switch counts; the repositories table keeps a repository switched off as the workspace's own (author).
