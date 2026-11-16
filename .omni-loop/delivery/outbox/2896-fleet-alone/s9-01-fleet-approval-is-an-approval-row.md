---
id: s9-01-fleet-approval-is-an-approval-row
prd: 2896
slice: s9
rank: high
bears-on: BR-APPROVALS-1
raised: 2026-11-15
wave: 9
---

## The question, in plain words

When the fleet's committee approves a PRD, should that approval also count outside the mission that asked for it?

## The decision, in plain words

The fleet's approval is written like a person's, naming the fleet and the mission, so the page shows it and a later change cancels it. The mission only trusts its own, but the build's approval check cannot tell who is building, so a person building the same PRD by hand would see it approved too.

## The intro, for fun

Three agents said yes, and now the whole office thinks the boss signed it.

## The punchline, for fun

The signature says fleet, at least, in large letters.

## The options, in plain words

A. The fleet's approval is an approval row naming its fleet and its mission: the mission reads it for itself only, the build's approval check reads it for anyone (built).
B. Keep the fleet's approval in the mission's decisions only, and teach the build's approval check to accept it for that mission's own jobs.

## What I had to decide

Whether a fleet's approval may read as given to a build outside its own mission, or only to the mission's own jobs.

## What I did meanwhile

It reads as given to any build of the PRD; another mission's supervisor reads it as none and asks its own committee or a person.

## What it costs to change later

Option B needs the kit's approval reader and the approval route to learn the job's mission, outside this slice's territory, and keeps the page's words to change too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person ever builds by hand a PRD that sits in a running mission at alone
- (author) whether the page's words read exactly Approved by fleet <key>: the page's own code (apps/galaxy/src/dossier/page/approval.ts) was not changed and prints the approver's login, fleet <key>
