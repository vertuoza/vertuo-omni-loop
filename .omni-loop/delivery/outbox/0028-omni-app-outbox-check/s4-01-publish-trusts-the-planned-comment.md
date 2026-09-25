---
id: s4-01-publish-trusts-the-planned-comment
prd: 28
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When the check writes its outbox comment on a pull request, should it look again, just before writing, for a comment it may have posted a moment earlier?

## The decision, in plain words

No: it writes to the comment it found when it started checking, and creates one only if there was none then. Two checks racing on a brand-new pull request could leave two comments; the short wait between events makes that rare.

## The options, in plain words

A. Trust the comment found during the evaluation, as built.
B. Look the comments up again just before writing, and rewrite the marker comment if one appeared.
C. Let the check post a comment only when the evaluation found one, and never create one.

## What I had to decide

Whether the comment is looked up again at posting time, or the one found during the evaluation is trusted.

## What I did meanwhile

publish takes evaluate's planned comment ({ id, body }) as is: PATCH by id, or POST when id is null. It re-reads only the pull request's head SHA, to skip the comment when the head moved on. startCheck is a separate export that creates the check run in_progress; publish completes it.

## What it costs to change later

One extra comment listing inside publish and a marker match; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the per-PR debounce in the Inngest function (slice s5) is enough to make a duplicate comment practically impossible.
- (author) Where the marker text should come from at posting time, since publish has no kit context of its own.
