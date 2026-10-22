---
id: s4-01-target-lanes-from-synced-repositories
prd: 2370
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

When a PRD lands in several repositories, should the timeline also show the repositories the loop is not set up in?

## The decision, in plain words

The timeline shows a lane only for a repository the loop already reads every quarter hour, one that carries the loop's settings. A repository without them shows no lane for now.

## The intro, for fun

Some repositories never filled in the guest book.

## The punchline, for fun

So the party photo only shows the ones who signed in.

## The options, in plain words

A. Keep it: a lane only for a repository the loop already reads, with its settings.
B. Also read the plan's targets listed in its settings (or its product's repositories) even without the loop's settings, at the price of more GitHub reads every quarter hour.

## What I had to decide

Whether a target repository that carries no `.omni-loop/config.yml` should still give its PRD a lane. Today the stages sync only lists the repositories the App reaches that carry the config (`knowledgeReader.repos`), and the reader returns an empty snapshot for any other, so a config-less target is never read.

## What I did meanwhile

Built A: `targetMilestones` (apps/galaxy/src/stages/sync/milestones.ts) reads the target feature PRs of each repository the sync already reads, and the route records a lane only for a PRD a repository of the same workspace holds. No new repository is listed and no new list call is made; the one added read is the ready events of a target feature PR, as s1 already does for every feature PR.

## What it costs to change later

Low. Lanes are dated by GitHub's own times, so reading more repositories later (B) only means listing the plan's targets and reading their pull requests: the first sync of a repository reads it in full and fills every lane it shows, shipped PRDs included. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How many plan repositories of a workspace have targets without the loop's config is not known here: an imported or knowledge-less target (`plan.targets[].knowledge: imported | none`) may carry none.
- (author) Option B spends more of the App's GitHub budget each quarter hour (PRD 902); its cost was not measured.
