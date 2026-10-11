---
id: s7-02-a-terminal-answer-is-the-signed-in-persons
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When an answer to a product PRD's question is typed in the terminal, who does the record say gave it, and where?

## The decision, in plain words

The record says it was answered in the terminal, by whoever is signed in. Who approved it and when can still be given, and are checked as before, but the server keeps its own name and time.

## The intro, for fun

The terminal does not know who is typing, but the sign-in does.

## The punchline, for fun

So the sign-in signs for it.

## The options, in plain words

A. The signed-in person, in the terminal, the option built.
B. Keep the name and time given by hand beside the signed-in person.
C. Refuse an answer that does not say who gave it.

## What I had to decide

What an answer given through the terminal records on the server: its channel, and who and when.

## What I did meanwhile

The channel is the terminal, the person is the one signed in and the time is when it was saved; a name or a time given by hand is checked, then left to the server's own record.

## What it costs to change later

One small change on the server's record if a hand-given name must be kept too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an agent relaying a person's answer should record that person rather than itself.
