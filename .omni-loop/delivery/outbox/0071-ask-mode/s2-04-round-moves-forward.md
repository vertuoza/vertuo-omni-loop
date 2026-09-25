---
id: s2-04-round-moves-forward
prd: 71
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Once a question has been answered, or handed back to the terminal, may its answer still change, and may the web page still answer a question the terminal took over?

## The decision, in plain words

An answer, once given, is final, and a question handed back to the terminal can only be answered from the terminal, so the page never sends an answer nobody will read. Only the clean-up deletes sessions: their owners cannot.

## The intro, for fun

Some questions get a second chance; these ones get exactly one answer.

## The punchline, for fun

Changing your mind is still allowed, just not after the answer has left.

## The options, in plain words

A. Make every answer final, and let only the terminal answer a question it took over, the option built.
B. Let the page answer a question the terminal took over too, even though that answer never reaches Claude.
C. Also let people delete their own sessions whenever they like.

## What I had to decide

The spec gives the round's statuses (open, answered, abandoned) and `answered_via` (page, terminal), and says an abandoned round's terminal answer still shows on the page tagged terminal. It does not say which moves are allowed, whether an answer can be replaced, whether the page may answer an abandoned round, or whether an owner may delete a session. s4's page writes the page's answers.

## What I did meanwhile

A trigger (`ask_rounds_guard`) allows open to answered (page or terminal), open to abandoned, and abandoned to answered from the terminal only; an answer never changes, and `answered_at` is stamped. A closed session is never reopened (`ask_sessions_guard`), and closing stamps `last_seen_at`. Column grants: the owner inserts only `title` and `session_id, questions`, updates only `status, last_seen_at` and `status, answers, answered_via`, and deletes nothing.

## What it costs to change later

Loosening a rule is a new migration replacing a trigger function or a grant; no stored row changes shape. Meanwhile s4's page must not offer Send on an abandoned round, or the database refuses it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person should be able to delete a session before the week is out: the spec's scope is silent on it.
