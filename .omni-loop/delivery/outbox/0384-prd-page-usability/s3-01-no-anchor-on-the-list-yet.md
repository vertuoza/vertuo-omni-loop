---
id: s3-01-no-anchor-on-the-list-yet
prd: 384
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

After answering, the person is sent to the PRD's questions with a marker naming the next open question, but the list gives its questions no marker to jump to yet. Should this slice add those markers?

## The decision, in plain words

Not in this slice: the way back already names the next open question, and the list that must carry the markers is left to the later slice that owns it, so for now the person lands at the top of the questions.

## The intro, for fun

The return ticket names a seat, but the seats have no numbers painted on them yet.

## The punchline, for fun

The next crew brings the paint.

## The options, in plain words

A. Leave the list to s4: what was built; the marker in the way back starts working the day the list carries it.
B. Add the markers now, outside this slice's files: the landing works at once, but s4 would meet a change it did not plan for.
C. Drop the marker from the way back: nothing half-done, but the spec asks for it.

## What I had to decide

Whether the list of questions, which this slice may not change, should carry a marker on each question now, so the way back lands on the next open one.

## What I did meanwhile

The way back ends with the next open question's marker; the list is unchanged, so the browser shows the top of the questions until a marker exists.

## What it costs to change later

One attribute on each question of the list; the later slice that owns the list can add it with no other change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The list of questions is not in this slice's declared files; slice s4 owns it in the next wave (author).
