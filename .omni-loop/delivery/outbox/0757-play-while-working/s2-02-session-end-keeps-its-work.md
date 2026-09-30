---
id: s2-02-session-end-keeps-its-work
prd: 757
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When a terminal says it has finished, it sends no work with that last message. Should its record forget what it was working on, or keep it?

## The decision, in plain words

The last message only marks the session as finished and keeps what it was working on, so the page can still tell that this work's session ended rather than vanished.

## The intro, for fun

Leaving the room and forgetting which room you were in are two different things.

## The punchline, for fun

We chose to leave the room and remember it.

## The options, in plain words

A. The end marks the session finished and keeps its work and dossier, as built.
B. The end marks the session finished and clears its work and dossier, as the call's body reads literally.

## What I had to decide

The spec's SessionEnd call is {claudeSessionId, repo, work: null, ended: true}. Taken literally, the upsert would clear the row's work and dossier on the end. The spec does not say whether the end keeps or drops the work.

## What I did meanwhile

working_ping() with p_ended stamps ended_at and seen_at and keeps work_kind, work_number and dossier_id as they were; a later heartbeat without ended clears ended_at and sets the work again. Either way workingState reads the row as idle, so the pages behave the same today.

## What it costs to change later

Low: one branch of working_ping() in a follow-up migration; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec settles the end's body but not what the stored row keeps; the pages that read it (s4, s5) are not built yet, so no screen yet shows the difference (author).
