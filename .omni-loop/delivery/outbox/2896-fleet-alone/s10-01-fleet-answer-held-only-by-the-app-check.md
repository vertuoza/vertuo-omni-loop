---
id: s10-01-fleet-answer-held-only-by-the-app-check
prd: 2896
slice: s10
rank: high
bears-on: BR-PRODUCT-5
raised: 2026-11-16
wave: 10
---

## The question, in plain words

When the fleet answers a question for a mission, should the terminal's own check also keep the feature waiting before the main branch, or is the check the App runs on the pull request enough?

## The decision, in plain words

A question the fleet answered counts as answered for the mission's branch. The App's check on a pull request into the main branch still holds it until a person answers, but the check an agent runs in a terminal does not know where the pull request goes, so it reads the question as answered.

## The intro, for fun

The fleet signed the permission slip, but only for the school trip.

## The punchline, for fun

The main door still asks a grown-up.

## The options, in plain words

A. The App's check on a pull request into the main branch holds each question the fleet answered; the terminal's check reads it as answered (built).
B. The terminal's check learns the pull request's base too, and holds the fleet's answers toward the main branch the same way.

## What I had to decide

Whether a question the fleet answered keeps a feature a draft toward the main branch everywhere, or only in the App's check on the pull request. Bears on BR-PRODUCT-5, whose owner confirms the reading: changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

## What I did meanwhile

The merge gate into the mission branch and the terminal's gate read a question the fleet answered as answered; the App's outbox check on a feature pull request into the main branch fails on it, naming each such question, unless a person applies the override label.

## What it costs to change later

Option B adds a base to the terminal's outbox check and has the skills that mark a pull request ready pass it: a few files of the kit, no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a feature pull request of a mission ever goes to the main branch other than through the mission pull request: the PRD says it does not, unless a person retargets it.
- (author) Whether the owner reads BR-PRODUCT-5 as kept when the fleet's answer closes a question for the mission branch only, as the spec asks the owner to confirm.
