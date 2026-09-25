---
id: s7-02-retro-pr-named-once-it-is-open
prd: 72
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Each retro issue is meant to name the retro pull request, but the issues are opened just before that pull request exists. What should the first issues say?

## The decision, in plain words

An issue names the retro pull request only once one is open, so from a later run of the same retro on; the first time, it names the request being looked back on and the merged feature only. The pull request lists every issue, so the two are still linked.

## The intro, for fun

The issues arrive a moment before the pull request they are meant to introduce.

## The punchline, for fun

So the introductions wait for the next visit, when everyone is finally in the room.

## The options, in plain words

A. Name the retro pull request only once it is open, the option built.
B. Once the pull request opens, go back and add its number to each open issue, in one more step of the retro.
C. Name the retro's branch instead, which is known from the start but goes away once the pull request is merged.

## What I had to decide

The spec's issue header reads `**Retro of PRD 50** (#50 · feature PR #51 · retro PR #…) · F1`, while the function runs the step `publish-issues` before `publish`, so the retro PR's number is unknown when the issues are first written. The function and `publish` are outside s7's territory (s8 owns both in wave 4).

## What I did meanwhile

`publishIssues` reads the pull requests from the retro branch (`branches.retro` with the topic) and names the open one, else the latest, in the header; with none, the header reads `(#7 · feature PR #12) · F1`. A replay or a later run rewrites the open issues with the number.

## What it costs to change later

A constant: one part of the header. Naming the PR on the first run needs a step after `publish` that rewrites the open issues, in the function (s8's territory).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `retro PR #…` in the spec was a placeholder for the number, or meant a link that can only come once the pull request is open.
