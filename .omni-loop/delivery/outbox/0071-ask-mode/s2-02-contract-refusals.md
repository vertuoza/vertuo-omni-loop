---
id: s2-02-contract-refusals
prd: 71
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The agreed list of calls says what each call returns when it works, but not what it says when it cannot, such as a question sent to a session that is already over. What should those answers be?

## The decision, in plain words

Each refusal carries a standard code and a short reason: not signed in, not in the team, not found, already over, already answered, or the service is down. Whatever the refusal, the question falls back to the terminal, and closing a session or giving up on a question twice is simply fine.

## The intro, for fun

Every call already knows how to say yes; this one is about the polite ways to say no.

## The punchline, for fun

Now even the refusals come with a reason and a way home.

## The options, in plain words

A. Answer each refusal with a standard code and a short reason, and accept closing or giving up twice, the option built.
B. Answer every refusal the same way, so the hooks only learn that something went wrong.
C. Answer an ended session with a code that says it is gone for good, kept apart from the other refusals.

## What I had to decide

The spec's contract table fixes each call's success shape only. s1's hooks, built in the same wave, must tell a closed session from a network failure ("a `closed` session deletes `ask.json`"). Also unset: the success status (200 or 201), whether close and abandon may be repeated, what `/answers` does on a round the page already answered, and the input limits.

## What I did meanwhile

Every success is 200. `POST /sessions/:id/rounds` on a closed session, or one 12 hours idle: 409 `{error, status: "closed"}`. `/answers` or `/abandon` on an answered round: 409 `{error, status: "answered"}`, the page's answer kept. `close` answers `{id, status: "closed"}` and `abandon` `{id, status: "abandoned"}`, both again on a repeat. `/answers` takes `via: "terminal"` only (400 otherwise), records on an abandoned round too, and answers `{id, status: "answered", via: "terminal"}`. 401: no or invalid token; 403: not crew; 404: missing, another owner's, or not a uuid; 503: no database configured, or the Auth server unreachable; 500: a database error; 413: a body over 256 KiB; 400: a title outside 1 to 200 characters, or `questions` that is not a non-empty list of objects with `question` text (stored as given otherwise).

## What it costs to change later

Each is a constant or one branch in `apps/galaxy/src/ask/api.ts` and its test; no stored data depends on it. If s1's hooks already read another shape, one side's code changes, not the database.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) What s1's hook client expects on a closed session or an answered round: it is built in parallel, and its branch had no code pushed when this slice was built.
