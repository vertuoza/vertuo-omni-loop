---
id: s6-02-roadmap-push-outside-territory
prd: 1162
slice: s6
rank: medium
bears-on: none
raised: 2026-10-07
wave: 3
---

## The question, in plain words

Sending a roadmap to the app needed one small addition to a shared file this piece of work was not meant to touch, and the command had to start without the usual setup so tests can stand in for the sign-in.

## The decision, in plain words

The shared sign-in client gained one line that sends a roadmap, beside the one that sends a loop. The roadmap command now loads its own setup, as the loop command does; nothing it prints or refuses changed.

## The intro, for fun

One line, one file over the fence.

## The punchline, for fun

We knocked, nobody was home, so we left it by the loop's line.

## The options, in plain words

A. Add one sending line to the shared client and let the command load its own setup (built)
B. Write a second sender with its own sign-in refresh inside the roadmap code
C. Open up the client's private call so any code can post anywhere

## What I had to decide

`kit/lib/ask/client.ts` is outside s6's territory, but its `call` (the 5-second limit and the one token refresh) is private: `pushRoadmap(body)` was added beside `pushLoop`, posting to `/api/roadmaps`. `omni roadmap` became a `withoutContext` command, like `loop` and `dossier`, so a test hands it `tokens`, `fetch` and `callMs`; `check` loads the context itself and behaves as before. The comment in `kit/bin/commands/index.ts` that lists the context-free commands does not name `roadmap` yet: that file is outside the territory too.

## What I did meanwhile

Built as described; every `omni roadmap check` test still passes unchanged.

## What it costs to change later

Nothing to undo: the client line is additive; the index comment is one word for a later slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) None: the change is additive and every existing roadmap check test passes unchanged.
