---
id: s1-02-branch-kept-on-the-session
prd: 144
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The design keeps the branch and the Claude session on the whole ask session, but they arrive with each question and can change while ask mode stays on. Which one should the session keep?

## The decision, in plain words

The session keeps the latest one a question named. A question that names none leaves it as it was, so every question of the session shows the latest branch.

## The intro, for fun

A session can hop branches mid-conversation, like a squirrel that forgot where it buried lunch.

## The punchline, for fun

We write down the tree it is sitting in right now.

## The options, in plain words

A. Keep the latest branch and Claude session on the session, updated by each question that names them
B. Also record the branch and the Claude session on each question, so an older question keeps its own

## What I had to decide

Keep the latest branch on the session, or record the branch on each question as well.

## What I did meanwhile

The context line of each question shows the session's latest branch and Claude session.

## What it costs to change later

Moving them onto each question later is two optional columns and a small change to the page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's data section puts branch and claude_session_id on ask_sessions, while the session open sends only the repo (author)
