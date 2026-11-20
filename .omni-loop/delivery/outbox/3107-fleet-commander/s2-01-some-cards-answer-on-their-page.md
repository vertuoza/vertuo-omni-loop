---
id: s2-01-some-cards-answer-on-their-page
prd: 3107
slice: s2
rank: high
bears-on: ADR-0052
raised: 2026-11-20
wave: 2
---

## The question, in plain words

The spec says every card in the Waiting on you rail is answered from the card, but an outbox question of a repository PRD is answered on its pull request, and a job asking several questions at once needs all its answers together. Should those cards be answerable from the rail?

## The decision, in plain words

Those cards show their question and link to the page where it is answered, as the approval card already does. A job's single question with one pick, and a mission item (Adopt or Decline), are answered from the card.

## The intro, for fun

Some questions wear a badge that says: answer me at home, please.

## The punchline, for fun

So the rail points the way instead of knocking on the wrong door.

## The options, in plain words

A. A. As built: outbox items, multi-question jobs and multi-pick questions link to their own page; the rest answer from the card.
B. B. Answer a job's several questions from the card too, one pick per question, Confirm once all are picked.
C. C. Add an answer route for repository PRD outbox items that posts the member's reply on the feature pull request, and answer them from the card.

## What I had to decide

Whether link-only cards are enough for now, or the rail must answer every kind of question itself.

## What I did meanwhile

Link-only cards send the member to the question's own page, so nothing waiting is hidden; the rail only answers what it can send through an existing answer route.

## What it costs to change later

Small to change later: answering several questions on one card is a few more fields on the card and one more state; answering a repository PRD's outbox item needs a new answer route that replies on the pull request.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The app has no route that answers an outbox item of a repository PRD; the existing answer route only answers product PRDs, and no mission runs one (author)
- Knowledge read: ADR-0052 (every answer door ends as the person's own reply on the feature PR), ADR-0061 (prd_outbox keeps each PRD's waiting questions)
