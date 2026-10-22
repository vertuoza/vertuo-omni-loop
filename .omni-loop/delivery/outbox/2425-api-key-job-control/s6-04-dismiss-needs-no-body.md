---
id: s6-04-dismiss-needs-no-body
prd: 2425
slice: s6
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

A key dismisses the questions of a job with nothing to add. Should it have to send a body at all?

## The decision, in plain words

No: a dismissal with no body, or an empty one, is accepted and acts for no one, and a body that holds anything but the optional name of whom the key acts for is refused, naming the field.

## The intro, for fun

Saying no thanks should not need a form.

## The punchline, for fun

A bare request closes the round just as well.

## The options, in plain words

A. A. A dismissal needs no body: none, an empty one or an empty object all work.
B. B. A dismissal needs a body, an empty object at least, as the answer does.

## What I had to decide

The spec says the dismissal takes the optional name of whom the key acts for, and nothing more. It does not say whether a call with no body at all is allowed. A body made only of optional fields is optional in most clients, and a call with no body is the shortest way to dismiss, so an empty body, or one of spaces, is read as an empty object. The answer route keeps its body required, since an answer needs its answers.

Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

Read an empty body as an empty object on the dismissal only, and proved no body, an empty body, a blank body and an empty object all dismiss, while a body that is not JSON, one with a field it does not know and one over 4 KiB are refused with 422.

## What it costs to change later

Changing it later means one flag in the controller; no stored row depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the apps that call the API send a body on every POST and would never notice.
