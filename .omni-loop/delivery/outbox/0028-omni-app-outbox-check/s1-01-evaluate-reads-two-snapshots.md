---
id: s1-01-evaluate-reads-two-snapshots
prd: 28
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should the check read the main branch's settings and the pull request's outbox from one combined copy of the files, or from two separate copies?

## The decision, in plain words

Two separate copies: one of the main branch's settings, one of the pull request's delivery folder. A settings file inside the pull request is simply never looked at, so a pull request cannot quietly rename the override label.

## The options, in plain words

A. Two copies, the main branch's settings and the pull request's outbox, as built.
B. One combined copy holding the main branch's settings next to the pull request's outbox.
C. Two copies, but the comment is worked out at posting time rather than during the check.

## What I had to decide

The spec's unit table says evaluate takes one folder, but decision 4 says config comes from base and delivery from head, and the test seams ask that a head which renames the override label leaves the verdict unchanged. One merged folder cannot hold both a base and a head config, so that test would have nothing to prove. The spec also does not say how evaluate learns which outbox comment already exists.

## What I did meanwhile

evaluate takes `base` (a folder holding the base branch's `.omni-loop/config.yml`, or nothing) and `head` (a folder holding `paths.delivery` at the head SHA); the kit's context is rooted at `head` with the config parsed from `base`. It also takes `comments` (the PR's existing comments) and returns `comment: { id, body }` (id null = create, else rewrite) or null, computed by running the kit's `upsertOutboxPrComment` against an in-memory client. s4's `snapshot` is called twice with its list of paths; s5 fetches the PR's comments in the evaluate step and s4's `publish` posts the plan.

## What it costs to change later

A constant-level change: if one merged folder is preferred, evaluate reads the config from the same root and the renamed-label test is dropped. No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec author meant one folder built from two refs, or was describing the unit loosely.
- (author) Whether publish should re-list comments at post time instead of trusting the id evaluate saw; a marker comment created between the two would be duplicated.
