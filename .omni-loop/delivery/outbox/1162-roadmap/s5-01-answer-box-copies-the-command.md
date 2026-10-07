---
id: s5-01-answer-box-copies-the-command
prd: 1162
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The roadmap page's answer box should leave a person's answer on the roadmap's issue. Should the page post that comment itself, or hand the person the one line that posts it?

## The decision, in plain words

The box turns the answer into the one line that records it, with a copy button and a link to the roadmap's issue. The page does not post anything to GitHub yet.

## The intro, for fun

A text box that wants to talk to GitHub, but has nobody to pass the note to yet.

## The punchline, for fun

So it writes the note neatly and hands it to you to deliver.

## The options, in plain words

A. A. The box writes out the answer command to copy, and links the issue; posting from the page comes later
B. B. The page posts the comment itself now, through a new API route and the App's authorisation as the person
C. C. The box only links to the roadmap's issue, and the person writes the comment by hand

## What I had to decide

The spec says the page's answer box writes the same comment as `omni roadmap answer`. Posting from the page needs a write path to GitHub as the person (the GitHub App's authorisation, as the Outbox tab's Send does, through an API route) that is outside s5's territory, and the comment's marker is s6's (`kit/lib/roadmap/answers`), not built yet in wave 2.

## What I did meanwhile

`AnswerBox.tsx` shows a textarea for each unanswered `person` question; as the person types, it shows `omni roadmap answer <n> <Q> "<answer>"` with a Copy button, beside a link to the roadmap's issue. Nothing is written by the page.

## What it costs to change later

Small: a later slice swaps the box's copy step for a Send button posting through a new `/api/roadmaps/answer` route that reuses s6's marker; the box, its place on the page and the question model stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any workspace member may answer a person question from the page, or only some (author)
- Which GitHub account the page would post as: the person's, through the App's authorisation, is assumed (author)
