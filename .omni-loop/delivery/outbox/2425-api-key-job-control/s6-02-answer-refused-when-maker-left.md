---
id: s6-02-answer-refused-when-maker-left
prd: 2425
slice: s6
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

A key answers the questions of a job, but the person who made the key that sent the job has left the workspace. Should the answer go ahead?

## The decision, in plain words

No: the answer is refused as not allowed and nothing is closed, so the questions stay open for a person to answer on the page, because the job that resumes would be sent in the name of someone who is no longer a member.

## The intro, for fun

The key still works, but the hand that made it has left the room.

## The punchline, for fun

A person on the page can still pick up the question.

## The options, in plain words

A. A. The answer is refused as not allowed, nothing is closed, and the questions stay open for the page.
B. B. The answer goes ahead and the job that resumes is sent in the name of the maker who left.

## What I had to decide

The spec says the job that resumes is sent by the same key and the person who made it, whoever answers; it does not say what happens when that person left the workspace. The page's own automatic continuation of a key's job already refuses in that case, through the same member check, so the key's answer does too, before anything is closed or queued. The key reads 403 with words that name the reason.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Added the check to the key's answer in the runners' rules and proved it: nothing is closed, nothing is queued, and the key reads 403 while the questions stay open for the page.

## What it costs to change later

Changing it later means removing one check in the runners' rules; no stored row depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the owner of a key whose maker left should be able to hand the job to someone else to answer.
