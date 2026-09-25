---
id: s6-02-evidence-excerpt-beside-its-link
prd: 72
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the model reads each finding's evidence, such as the end of a failed log or the lines of code rewritten, but nothing says where each kind of finding puts those extracts. Where should they go?

## The decision, in plain words

Each piece of evidence may carry its extract beside its link, listed oldest first. When the input grows too long, older logs go first, then rewritten code, then comments, and the latest log of each check always stays.

## The intro, for fun

The findings packed their clippings, but the suitcase had no pocket labelled for them.

## The punchline, for fun

So each clipping rides beside its link, and the oldest ones step off first when it gets crowded.

## The options, in plain words

A. An extract beside each piece of evidence, listed oldest first, the option built.
B. A separate list of extracts on each finding, each with the time it was taken, so its age is read rather than assumed from the order.
C. No extracts at all: the model reads only the facts and the links, and writes shorter prose.

## What I had to decide

Where `narrate` reads evidence excerpts from. The `Finding` contract in `src/retro/kinds/index.mjs` is `{ id, kind, title, happened, evidence: [{ label, url }] }` and names no excerpt; slices s3, s4 and s5 build the kinds in parallel with this one. The spec ("The model, and the guard") asks for "its evidence excerpts (failed-job log tails of about 200 lines, the hunks of churn ranges, the text of stuck and review comments)", capped so that "older attempts' logs go first, then hunks, and the latest failure of each check always stays".

## What I did meanwhile

`modelInput` in `src/retro/narrate.mjs` reads an optional `excerpt` string on each evidence item. A finding's `source` (its kind's registry id, set by `detect`) says what an excerpt is: `ci` a log tail, `churn` a hunk, any other a comment; a `ci` finding's last excerpt is its latest failure. Tokens are counted as 4 characters against `LIMITS.modelInputTokens`. Past the cap, older `ci` excerpts go (oldest first), then `churn` ones, then the rest (least severe finding first); then the latest logs are cut to their last lines, then the least severe findings. Until a kind sets `excerpt`, the model gets each finding's facts, labels and links only.

## What it costs to change later

One reader in `narrate.mjs` if the kinds put excerpts elsewhere; for the kinds, one optional field per evidence item.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s3, s4 and s5 give their evidence an excerpt and list it oldest first: none had pushed code when this was built.
- (author) How closely four characters a token matches the model's own count on log output.
