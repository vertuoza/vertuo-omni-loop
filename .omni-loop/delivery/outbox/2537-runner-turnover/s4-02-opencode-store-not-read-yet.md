---
id: s4-02-opencode-store-not-read-yet
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

For an OpenCode account run through T3, where should the runner read the steps, the tokens and how full the context is?

## The decision, in plain words

For now an OpenCode run shows the messages T3 reports as its steps, and counts no tokens and no context: the runner does not read OpenCode's own session store yet.

## The intro, for fun

OpenCode keeps a diary, but nobody here has seen what its pages look like yet.

## The punchline, for fun

So the runner reads the postcards T3 forwards instead.

## The options, in plain words

A. Show T3's messages as an OpenCode run's steps and count no tokens until a recording of OpenCode's store exists (built).
B. Read OpenCode's session store now, from its documented layout, with no recording.
C. Record an OpenCode run on the laptop first, then read its store in a slice of its own.

## What I had to decide

s4's done-when asks for OpenCode's session store. Neither T3 0.1.3's source nor the laptop trial's recordings show its layout (recent OpenCode versions moved it from JSON files under `~/.local/share/opencode/storage` to a SQLite database), so any reader would be a guess with no recording to test it on. `t3-run` prints the new assistant messages of `t3 thread show` for an instance that is not Claude, the `t3` agent turns them into `›` step lines, and its `usage()` and context are `null` for it.

## What I did meanwhile

An OpenCode job runs, its log shows T3's messages, its report carries no tokens (null, never 0), and it reads no context pressure, so it hands off at the wall only.

## What it costs to change later

A reader module and a recording of the store; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The layout of OpenCode's session store in the version the runner's machine runs (author)
