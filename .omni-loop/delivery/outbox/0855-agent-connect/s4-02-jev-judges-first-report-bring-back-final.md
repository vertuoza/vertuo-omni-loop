---
id: s4-02-jev-judges-first-report-bring-back-final
prd: 855
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

When should Jev judge an agent's question, and may it set aside again a question a person brought back?

## The decision, in plain words

Jev judges a question only the first time it arrives, not each time it is asked again. Once a person brings a question back, Jev never sets it aside again.

## The intro, for fun

Jev said the question was junk, and a person disagreed.

## The punchline, for fun

The person wins, and Jev does not get a second go.

## The options, in plain words

A. Jev judges a question once, on its first report, and a question a person brought back stays open (built).
B. Jev judges every report again, and may set aside again a question a person brought back.

## What I had to decide

The spec says Jev runs after a report and that Bring back reopens a set-aside question, but not whether a repeated question is judged again, nor whether Jev may set aside a question a person brought back. A repeat only bumps 'asked N times' on the same row, so judging it again would cost a Jev call for the same words; and setting aside again what a person brought back would undo the person's choice.

## What I did meanwhile

Built option A: the MCP link hands a report to Jev only when it stored a new row (asked once). agent_question_set_aside() changes only an open question with no brought_back_at, a column Bring back sets. A repeat of a set-aside question stays set aside and still adds to its count.

## What it costs to change later

Option B is a one-line change in the web app and dropping one condition in a database function; the brought_back_at column would simply go unused.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a set-aside question asked many more times should come back on its own (author).
