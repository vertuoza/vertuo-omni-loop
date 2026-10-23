---
id: s1-01-outcome-recorded-by-member
prd: 2498
slice: s1
rank: high
bears-on: BR-PRODUCT-63
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Who may write down what became of an approved finding: only the Omni App and the agent working for the team, or any member of the team too?

## The decision, in plain words

The Omni App, or anyone signed in as a member of the finding's team, since the agent on a runner signs in as the member who made its token. Each finding still takes one outcome, once.

## The intro, for fun

An agent and its maker walk into a database, and the database cannot tell which one knocked.

## The punchline, for fun

So both get in, and whoever writes first writes for good.

## The options, in plain words

A. The service role or any signed-in member of the finding's workspace, the option built.
B. The service role only: the s2 endpoint checks the caller is a member, then records the outcome as the service role.
C. Only a session made by a kit token: the database reads the token behind the session, which needs the kit token's session to carry its id.

## What I had to decide

Whether a member signed in by hand may record a finding's outcome, or only the App and the runner's agent.
Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

rewind_finding_outcome() lets in the service role or a signed-in member of the finding's workspace; anyone else is refused (42501). An outcome is written once, so a member cannot rewrite what the agent recorded, nor the reverse.

## What it costs to change later

Narrowing it later is one follow-up migration replacing the function's first check; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec names an agent link, but an agent link (omb_) is read-only and a runner's omni command signs in through a kit token as its maker, so no database check tells the agent from the member
