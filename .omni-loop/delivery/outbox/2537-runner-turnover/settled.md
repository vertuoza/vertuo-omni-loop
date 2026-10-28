# Settled outbox items — PRD 2537

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-claude-limit-recordings -->

## s1-01-claude-limit-recordings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-01-claude-limit-recordings -->

<!-- omni-outbox-settled: s1-02-claude-check-own-secret -->

## s1-02-claude-check-own-secret — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-claude-check-own-secret
prd: 2537
slice: s1
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

Before a job starts on a Claude account that carries its own sign-in key, how does the runner know the key still works?

## The decision, in plain words

It only checks that Claude is installed and that the key is not empty: a key that no longer works shows up as a failed job, not as an account marked unusable beforehand.

## The intro, for fun

A key on the hook looks the same whether it opens the door or not.

## The punchline, for fun

We only find out by turning it, so the runner turns it on the first job.

## The options, in plain words

A. Check the key is there and not blank, the option built.
B. Prove the key with one short call to Claude when the runner starts, and mark the account not signed in when it fails.

## What I had to decide

Whether a direct Claude account with its own key is checked only for an installed Claude and a key that is not blank, or by a call that proves the key, which costs a request each time the runner starts.

## What I did meanwhile

The check runs claude --version for every account; an account with no key of its own also runs claude auth status, as the runner does today; an account with a key passes unless the key is blank, which reads not signed in.

## What it costs to change later

One branch in the check of the claude adapter.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether claude auth status reports the key a run is given in its variables rather than the machine's own sign-in; it was not tried, so it is not relied on

```

<!-- /omni-outbox-settled: s1-02-claude-check-own-secret -->
