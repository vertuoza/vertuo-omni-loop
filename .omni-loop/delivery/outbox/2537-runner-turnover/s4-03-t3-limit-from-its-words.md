---
id: s4-03-t3-limit-from-its-words
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

T3 knows when a run hit its account's usage limit, but its command line only passes on the error message. How should the runner tell a limit from a crash?

## The decision, in plain words

The runner reads T3's error words: a usage or rate limit message is a limit, and its reset is counted from the wait the message names, or guessed when it names none. T3's own folder is taken to be the usual one in the home.

## The intro, for fun

T3 knows exactly why a run stopped; it just only says so in a sentence.

## The punchline, for fun

The runner has learnt to read between the lines.

## The options, in plain words

A. Read the limit from T3's error words, and T3's files from the usual folder (built).
B. Read the limit from T3's own database on the machine.
C. Ask T3 to add the failure class and its reset to its JSON output, and read the words until then.

## What I had to decide

T3 0.1.3 keeps a failure class (`usage_limit`) and a reset time for each failed run, but `t3 thread start --wait --json` and `t3 thread show --json` give only the status and the error message (`apps/server/src/mcp/OrchestratorMcpService.ts` renders an error item as `failure.message`). The `t3` agent's `limit()` matches `usage limit reached`, `rate limit reached` and `hit your limit`, and reads `resets in 2h 30m` or `resets in 1d 3h` from the run's end time; none named, the reset is `null` and the runner's one-hour guess applies. Its reads of T3's own files assume `~/.t3`: `T3CODE_HOME` is not read, since the environment is read in `kit/lib/env/read.ts` only, outside this slice.

## What I did meanwhile

A limit T3 words differently reads as a crash: the job fails as today and no other account takes over, which the spec's risks already accept.

## What it costs to change later

A regular expression and a constant; reading a failure class later replaces them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether T3 will give the failure class and reset in its JSON output (author)
- Whether any runner's machine sets T3CODE_HOME (author)
