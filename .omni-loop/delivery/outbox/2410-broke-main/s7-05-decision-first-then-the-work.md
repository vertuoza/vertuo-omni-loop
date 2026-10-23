---
id: s7-05-decision-first-then-the-work
prd: 2410
slice: s7
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-10-23
wave: 5
---

## The question, in plain words

Approve both records a decision and sends work (a job, a proposal or an issue). Which comes first, and what happens when sending fails?

## The decision, in plain words

The decision is recorded first, so two members clicking at once send the work once. When the work then fails to go, the approval stays, the card says what was not sent and what to run instead, and nothing retries it.

## The intro, for fun

Two members clicked Approve in the same second, and the robot had to pick a winner.

## The punchline, for fun

First click wins the vote; the second one gets a polite already done.

## The options, in plain words

A. Record the decision first, then send; a failed send is said on the card, never retried (built).
B. Send first, then record the decision.
C. Keep whether the work went beside each approval, with a Send again button.

## What I had to decide

Pick A to keep the decision first, B to send first and record after, or C to keep a sent or failed mark beside each approval with a Send again button.

## What I did meanwhile

POST /api/rewind/findings/<id>/approve checks the finding is still proposed, records the decision through rewind_finding_approve, which locks the finding and refuses a second one, and only then queues the job, files the proposal or opens the issue. A follow-up that fails is logged and answered as Approved, but … with the line to run from a terminal or where to do it by hand; the decision is never rewritten (BR-PRODUCT-12).

## What it costs to change later

B risks the same job or issue sent twice when two members click at once. C is a new column on the findings table, a migration, and a retry route.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) What Approve sent is said on the card once, after the click; a reload shows who approved and when, not whether the job or the issue went.
- (author) A follow-up that failed is not recorded anywhere a later reader sees, except the server's log.
