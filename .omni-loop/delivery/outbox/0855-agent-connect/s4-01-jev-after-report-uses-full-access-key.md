---
id: s4-01-jev-after-report-uses-full-access-key
prd: 855
slice: s4
rank: high
bears-on: ADR-0051
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Jev judges a new question from an agent after the agent got its answer. Which key may the web app use to read that question and to set it aside?

## The decision, in plain words

The web app uses its full-access database key for this, the same way every other Jev decision already reads its settings and its key. Checking the agent's link still never uses it.

## The intro, for fun

Jev needs a key to tidy the questions pile.

## The punchline, for fun

It borrowed the one every Jev decision already carries.

## The options, in plain words

A. The full-access key reads the question and sets it aside, as for every Jev decision (built).
B. The agent's link carries Jev's verdict through a database function that checks the link, and the full-access key reads only Jev's settings and key.

## What I had to decide

The spec says the link is checked by the database and that the web app gains no power for it. Jev's settings and its key can only be read with the full-access key (PRD 812), and Jev runs after the agent's call, so the link alone cannot carry the verdict. Reading the question and setting it aside therefore run with that key, through two database functions only it may call (agent_question_for_jev, agent_question_set_aside).

## What I did meanwhile

Built option A: apps/galaxy/src/agent-connect/mcp/live.ts hands a first report to Jev through Next's after(), with jevDecideDeps() and serviceDb(); without SUPABASE_SERVICE_ROLE_KEY Jev never runs and every question waits for a person. The token check is untouched.

## What it costs to change later

A constant-sized change: option B is one more link-checked database function and about twenty lines in the web app; no stored data changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether ADR-0051's list of service-role uses should name Jev's decisions, which PRD 812 already added (author).
