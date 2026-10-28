---
id: s1-01-claude-limit-recordings
prd: 2537
slice: s1
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

How does the runner know that Claude ran out of its plan, and how full its memory of the job is, when nobody on the team has caught a real run hitting its limit yet?

## The decision, in plain words

We taught the runner the shapes Claude's own program says it prints, wrote sample runs in those shapes, and count a model's memory as 200,000 words-pieces, or a million when its name says so.

## The intro, for fun

Nobody wants to burn a whole plan just to see what the wall looks like.

## The punchline, for fun

So we drew the wall from the blueprints and will check it when we bump into it.

## The options, in plain words

A. Keep the drawn recordings and the 200,000 or 1,000,000 window, the option built.
B. Catch a real limit run and a real warning run on the runner box, and replace the drawn recordings before s3 and s8 merge.
C. Read the window from each account's own context setting only, with no default, so a planned context handoff never fires on a guess.

## What I had to decide

Whether the sample runs that teach the runner Claude's limit and its pressure readings may stay drawn from the program's documented shapes, or must be replaced by runs caught on a real runner before the turnover slices rely on them.

## What I did meanwhile

The recordings in kit/lib/runner/fixtures/claude/ follow the stream-json shapes of Claude Code 2.1 (the rate_limit_event's rate_limit_info, the synthetic rate_limit message, an is_error result); the context window is 200,000 tokens, 1,000,000 for a model whose name ends in [1m], and the context counts the last message's input, cache and output tokens.

## What it costs to change later

Replacing a recording is a file swap and a test run; the window is one constant that s8's contextWindow setting overrides per account.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no real run at Claude's usage limit was captured: running claude from the slice's agent was refused, and no runner log on this machine holds one
- whether a real limit run carries a rejected rate_limit_event before its result, or only the words
- (author) whether the context should count the last message's output tokens, which the next turn reads back
