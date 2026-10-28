---
id: s3-02-how-a-part-reads
prd: 2537
slice: s3
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

The design says how a job's parts read on the Runners page and why a job fails when it runs out of accounts, but not every word: what time zone, what a part that ended on its context says when no percent is known, and what the failure says when the job changed account too often.

## The decision, in plain words

Times read in UTC, as the rest of the app gives them; a part that ended on its context reads context full, and one on a usage warning reads usage warning, until a later slice adds the percent; the agent and model sit after the tokens beside the status; and a job that changed account three times fails saying no tokens left, then that it changed account three times, the most a job may.

## The intro, for fun

Every part of a job got a name tag, and someone had to pick the font.

## The punchline, for fun

We picked the plainest one and left room for the percent to join later.

## The options, in plain words

A. A. Keep the words as built: UTC, context full and usage warning until a percent exists, the agent after the tokens, the cap named after no tokens left.
B. B. Show the reader's own time zone, and the agent right after the status.
C. C. Give the cap a reason of its own that does not start with no tokens left.

## What I had to decide

The words of a part's line and of the cap's failure: `HH:MM` in UTC (title: `<account> out until HH:MM UTC`, `(guessed)` when the agent named no reset); `usage limit`, `usage warning`, `context full`, `done`, `failed` for the end, the spec's `usage <n> %` and `context <n> %` waiting for a percent the part does not carry yet (s8); the agent and model after the tokens, so the running row still reads `Running 12 min 1.5M tokens`; the cap's reason `no tokens left: the job changed account 3 times, the most a job may`, which starts as the done-when's `no tokens left:` while naming the cap, as the spec's Caps section asks.

## What I did meanwhile

Built them in apps/galaxy/src/runners/page/parts.ts and kit/lib/runner/turnover.ts, with tests of each word. A direct Claude part names its model only when its transcripts can be read; otherwise the line names the account alone.

## What it costs to change later

Each is a constant or one line in parts.ts or turnover.ts; nothing is stored in these words, so changing one changes every row at once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the page should show the reader's own time zone instead of UTC. (author)
- The part has no usage or context percent yet: s8 adds the planned handoffs and may add the field. (author)
- A direct Claude part whose transcripts cannot be read names no model, though its stream named one: the adapter's usage reads the model only with the tokens. (author)
