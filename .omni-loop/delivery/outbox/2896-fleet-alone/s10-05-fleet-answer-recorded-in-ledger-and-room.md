---
id: s10-05-fleet-answer-recorded-in-ledger-and-room
prd: 2896
slice: s10
rank: medium
bears-on: none
raised: 2026-11-16
wave: 10
---

## The question, in plain words

Where should the fleet's answer to a question be kept: in the mission's list of decisions like its approvals, or in the question's own record and the mission's history?

## The decision, in plain words

The answer is kept where every answer to a question is kept, with the question, the option and each member's verdict, and the mission's history says it was decided or sent to a person. It is not yet a row of the mission's list of decisions, which only takes approvals today.

## The intro, for fun

The minutes were written in the notebook, not yet typed into the binder.

## The punchline, for fun

Every word is there, just on a different shelf.

## The options, in plain words

A. The answer lives in the question's settled record and the mission's events; the decisions list keeps approvals only (built).
B. A migration lets the App write each answer to the decisions list too, beside the record.

## What I had to decide

Whether this slice writes the fleet's answers to the mission's decisions list, which needs a database change outside its ground, or keeps them in the question's record and the mission's events.

## What I did meanwhile

The answer, its option and the verdicts are in the PRD's settled questions; the mission records a decided or escalated event signed by the PM and agent; the committee's job is sent with no mission key and found again by its line, since the database's key shape holds no question.

## What it costs to change later

Option B is one migration (a writer for answers, a key shape for a question's committee) and the App calling it; answers given before it would not be in the list unless read back from the ledger.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names one decisions list for approvals and answers; the slice's ground holds no migration.
- (author) Whether the next slice, which lists every answer on the mission pull request and lets a person overturn one, prefers to read the list or the ledger.
