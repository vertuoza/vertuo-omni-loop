---
id: s17-01-archive-reaches-github-by-reconcile
prd: 2011
slice: s17
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

When an owner presses Archive, how does the plan repository actually become read-only on GitHub, and how fast?

## The decision, in plain words

Pressing Archive only records the owner's decision on the server; the GitHub App, which alone holds its key, checks every five minutes and makes each plan repository read-only (or writable again after Undo) so it matches what the product says. So the repository turns read-only within five minutes, not instantly.

## The intro, for fun

The button speaks softly; the App listens on a five-minute timer.

## The punchline, for fun

Read-only arrives a short coffee break after the click.

## The options, in plain words

A. A. The App checks every 5 minutes and makes GitHub match the product, Undo included (as built)
B. B. A signed message from galaxy at the click makes the App act at once, with the timed check as a safety net
C. C. The App only archives; Undo unarchives nothing, and an owner makes the repository writable by hand on GitHub

## What I had to decide

Whether the archive should reach GitHub by a timed check in the App (as built), or by a signed message sent the moment the button is pressed, or by the App only ever archiving.

## What I did meanwhile

apps/omni-app/src/plan-archive/ adds the plan-archive function, run every 5 minutes, which reads each product's plan repository and archived date as the service role, looks up the App's installation on it, and calls PATCH /repos/{owner}/{repo} with archived true or false when GitHub's flag differs. galaxy's Archive route only calls product_plan_archive() as the signed-in owner; no GitHub key or call lives in galaxy.

## What it costs to change later

A constant and one small route: sending the message at once means a signed route in the App (outside this slice's territory) and a call from the archive route; the five-minute check can stay as the safety net. Undo unarchiving is one line in the function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the archive is made read-only on GitHub through the App but not how the App is told, and the slice's territory holds no route of the App that galaxy could call; the existing server event route is outside it
- (author) The App cannot tell a repository it archived from one an owner archived by hand on GitHub, so a plan repository whose product says not archived is made writable again on the next check, hand-archived ones included
