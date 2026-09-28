---
id: s4-01-request-waits-on-every-org
prd: 359
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When someone who is not their org's admin asks for Omni Loop, GitHub does not tell us which org they asked for. Which org should they be told they are waiting on?

## The decision, in plain words

They are recorded as waiting on every GitHub org of theirs that does not have Omni Loop yet, and the waiting screen names them all. Whichever of those orgs gets Omni Loop first, their next sign-in puts them in its workspace.

## The intro, for fun

GitHub passes on the request but loses the envelope with the org's name on it.

## The punchline, for fun

So the visitor waits politely at every door they have a key to.

## The options, in plain words

A. A: record a request for every org of theirs without the App (built)
B. B: ask the visitor on the waiting screen which org they asked for, and record only that one
C. C: have /signup ask for the org first and send it through GitHub's state parameter

## What I had to decide

Which org a sign-up request is recorded for, when GitHub's setup address carries no installation and no org.

## What I did meanwhile

On setup_action=request, finishSetup() reads the visitor's orgs with a fresh GitHub token, keeps those the App reports no installation for (GET /orgs/{org}/installation answering 404), and records one signup_requests row for each; /signup?waiting=<orgs> names them. At a later sign-in, completeRequests() only acts on an org the person still belongs to, so a request never outlives the membership.

## What it costs to change later

A constant: the set of orgs recorded is chosen in one loop; the table and the completion rule stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the request is recorded with its org, but GitHub's setup redirect for a request names no org, and the plan does not say how to learn it
