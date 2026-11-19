---
id: s3-02-answered-bug-stays-asked
prd: 3088
slice: s3
rank: medium
bears-on: none
raised: 2026-11-19
wave: 2
---

## The question, in plain words

When a person answers the question of a bug the team set aside, the bug fix carries on as that person's own job. Should the team follow that job and show the bug as being fixed again?

## The decision, in plain words

The team does not follow it: the bug keeps reading as set aside until its fix is merged or its issue is closed, which the App reads from GitHub. The team never asks about that bug again and never takes it again on its own.

## The intro, for fun

The person answered, and the bug fix went back to work without telling the team.

## The punchline, for fun

The team only hears about it again once the fix lands.

## The options, in plain words

A. A. The answered bug fix stays the person's own job, and the bug reads set aside until GitHub moves it (built).
B. B. The team follows the job that carries the answer, and the bug reads as being fixed again.

## What I had to decide

Leave the answered bug fix as the person's own job, the bug read as set aside until GitHub moves it (A), or have the team find the job that carries the answer and show the bug as being fixed again (B).

## What I did meanwhile

A set-aside bug stays set aside after its answer; its fix pull request, once merged, moves it on as any fix does.

## What it costs to change later

Following the answer later is one more read at the team's wake, of the job that carried the answer on, and a bug moved back to being fixed; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The job that carries an answer on is sent as the person who answered and holds no mission, so it does not count toward the team's budget either.
- (author) The spec says the answer puts the bug back to being fixed; no slice of the plan names who reads that.
