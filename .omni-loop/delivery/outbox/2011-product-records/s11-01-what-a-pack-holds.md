---
id: s11-01-what-a-pack-holds
prd: 2011
slice: s11
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

When a team merges a change to its notes and rules, what exactly goes into the saved copy, and which merges make one?

## The decision, in plain words

Any merge into the main branch that touches the notes folder, the settings file or a step file the settings name makes a copy of all three, read at that merge; a picture or any file over one megabyte is left out and named in the log, never squeezed in.

## The intro, for fun

A snapshot that takes a photo of the whole library every time one page changes.

## The punchline, for fun

The photos skip the paintings: words only, please.

## The options, in plain words

A. Pack the knowledge folder, the whole config and its hook files on every merge touching any of them, leaving out and naming a file a pack cannot hold (as built)
B. Pack only the planning keys of the config, as the copies did, and refuse the whole pack when one file cannot be held
C. Also keep binary files, base64-encoded, so a pack holds every file of the folder

## What I had to decide

Which files a knowledge pack holds (the knowledge folder alone, or also the decision folder, the playbook and the glossary when they live outside it, the whole config or only its planning keys, the hook files the flow names); which merges make one (every merge into the default branch that touches any of them, a rename out of the folder counted by its old path); which date a pack carries (the pull request's merge time); and what happens to a file a text column cannot hold (binary, a NUL, over 1 MiB) or a knowledge base past the snapshot's bound (2000 files, 20 MB).

## What I did meanwhile

The `knowledge-pack` Inngest function (apps/omni-app/src/knowledge-pack/) runs on the merge event the webhook already sends for every pull request merged into the default branch, beside the knowledge harvest, so the webhook is unchanged. It first asks the database whether any product holds the repository, and reads nothing on GitHub when none does. It reads the config at the merge commit, packs `paths.knowledge` with `paths.adr`, `paths.playbook` and `paths.glossary` when outside it, the whole `.omni-loop/config.yml`, and every hook file the flow names (a slash command names none); a file that is not UTF-8 text, holds a NUL or is over 1 MiB is left out and logged; a commit with no config or one that does not parse makes no pack; a knowledge base past the snapshot's bound makes no pack and is not retried. The pack's date is the pull request's `merged_at`. It runs at Inngest's lowest priority (`-600`), one run per repository at a time, and every GitHub call goes through the installation's budgeted client at background priority. It posts nothing on the merged pull request, failure included.

## What it costs to change later

Small: the paths are one pure module (paths.ts), the date one field, and nothing reads packs before s12. A pack already kept stays as it is; a changed rule applies from the next merge.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'the knowledge folder or flow config' without saying whether the whole config or only its planning keys (flow, landings, pr, contracts, as /omni:mega-invade copies) is the flow config
- (author) Nothing says what a pack does with a binary file such as a design mockup, which a text column cannot hold as it is
- (author) The spec says the newest pack is picked by the commit's date; the merge time GitHub gives is used, which is the merge commit's date for a merge or a squash, but not for a rebase merge
