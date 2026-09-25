---
id: s1-05-closed-session-signal
prd: 71
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a session has been closed on the page, the hooks should notice and switch the mode off in that checkout. How should they tell a closed session from a server that simply refused one question?

## The decision, in plain words

The hooks treat a session as closed only when the server says so while they wait for an answer. Any other refusal just sends the question to the terminal, and the mode stays on until it is switched off.

## The intro, for fun

Is the shop closed, or did the till just jam?

## The punchline, for fun

The hooks only believe the sign on the door.

## The options, in plain words

A. Only the waiting reply can close the mode, and any other refusal falls back to the terminal, the option built.
B. Add a closed reply to posting a question, so the first question after closing switches the mode off at once.

## What I had to decide

The contract says `GET /api/ask/rounds/:id/wait` answers `closed` for a closed or idle session, and s1's done-when says "a closed session deletes ask.json". It does not say what `POST /api/ask/sessions/:id/rounds` answers for a closed session.

## What I did meanwhile

Only a `wait` reply of `{status: "closed"}` deletes `ask.json` and `ask-round.json`. A refused round post (any non-2xx) prints nothing, so the terminal prompt shows, and `ask.json` stays. The fake server answers 409 to a round posted to a closed session; that is the fake's choice, not the contract's, and no test pins the hook to it.

## What it costs to change later

One branch in `preHook` once s2 names the reply.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- what s2's `POST /rounds` answers for a closed or 12-hour idle session
