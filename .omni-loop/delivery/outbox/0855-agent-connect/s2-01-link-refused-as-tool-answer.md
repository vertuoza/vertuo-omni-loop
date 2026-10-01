---
id: s2-01-link-refused-as-tool-answer
prd: 855
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

When an editor connects with a missing, wrong or revoked link, should the connection itself fail, or should it connect and answer every question with the one line saying to make a new link?

## The decision, in plain words

The editor connects and lists the tools, and each question it asks answers the one line saying to make a new link on Settings › Business, so the agent can tell its person what to do.

## The intro, for fun

A visitor with an old key still gets to the front desk.

## The punchline, for fun

The desk just tells them, politely, where to get a new one.

## The options, in plain words

A. Connect, list the tools, and answer each call with the one line as a tool error (built).
B. Refuse the connection with HTTP 401 and the one line, so the editor shows the server as failing.
C. Refuse a missing or malformed link with 401 at once, and an unknown or revoked one at the first call.

## What I had to decide

Whether a link that does not work fails the connection, or answers each question with the one line.

## What I did meanwhile

Every tool call with a bad link answers the one line as an error the agent reads; the database is never asked for a missing or malformed link.

## What it costs to change later

A constant: answering HTTP 401 instead is a few lines in the route and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not tried against a real Cursor or Claude Code session: how each editor shows a 401 without OAuth was not checked.
