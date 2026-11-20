---
id: s3-02-message-box-needs-no-model
prd: 3107
slice: s3
rank: medium
bears-on: none
raised: 2026-11-20
wave: 3
---

## The question, in plain words

Messaging the fleet needs no model, yet the screen draws no box when the Commander is off and a notice in its place when tokens are used up. Should a member still be able to message the fleet then?

## The decision, in plain words

The box stays as the screen draws it: off or out of tokens, there is no box, so no message can be sent from the tab then.

## The intro, for fun

The mail slot sits behind the same door as the oracle.

## The punchline, for fun

When the oracle sleeps, the door is shut for the postman too.

## The options, in plain words

A. A. As built: no box when the Commander is off or out of tokens.
B. B. Keep the box in those states with Message fleet alone, since it needs no model.
C. C. Keep the whole box and let Ask say why it cannot answer.

## What I had to decide

Keep the box hidden in the off and tokens-used-up states, as the drawn screens 2.C and 2.D show; the send route itself works in those states.

## What I did meanwhile

A member can still message through the route, and the Commander being off blocks only the tab's box.

## What it costs to change later

Small: show the Message fleet mode alone in those two states, one component and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The screen library draws the notice in place of the box and says nothing of Message fleet there
