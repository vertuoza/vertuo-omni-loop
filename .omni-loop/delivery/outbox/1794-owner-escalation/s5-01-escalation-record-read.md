---
id: s5-01-escalation-record-read
prd: 1794
slice: s5
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

To learn who is asked about a waiting question, the Omni page reads the note the GitHub App keeps on the feature pull request. Should it read that note on its own, or as part of the pull request summary it already reads?

## The decision, in plain words

The page reads the note on its own, one extra GitHub read per open feature pull request each time it recounts. When that read fails, the page keeps what it showed before, as it already does when the summary cannot be read.

## The intro, for fun

Two readers knock on the same pull request door, a few seconds apart.

## The punchline, for fun

One could carry both letters, but the second one stays within its own fence.

## The options, in plain words

A. A. A read of its own, inside the slice's territory: one more background GitHub call per open feature PR per recount; the stored dossier snapshot is unchanged.
B. B. Read the record from the comments the dossier's GitHub summary already fetches: no extra call, but the summary and its stored snapshot gain a field, outside this slice's territory.

## What I had to decide

Whether the record keeps its own read in apps/galaxy/src/stages/outbox/escalation-github.ts, or moves into the dossier's GitHub summary (apps/galaxy/src/dossier/github/reader.ts, summary.ts, and the snapshot schema), which already lists the feature PR's comments.

## What I did meanwhile

Each recount of a PRD at building or outbox with an open feature PR makes one more background GitHub read (the PR's first 100 comments), on the installation's budget. A PRD with no open feature PR costs nothing more. A failed record read keeps the PRD's stored counts until the next recount.

## What it costs to change later

Moving the read into the summary later is a few lines in four files outside this slice and an optional field in the stored snapshot: no migration, and the stored asked field stays as it is.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many open feature PRs a busy workspace holds at once, and so what the extra read costs on its budget, is not measured (author).
