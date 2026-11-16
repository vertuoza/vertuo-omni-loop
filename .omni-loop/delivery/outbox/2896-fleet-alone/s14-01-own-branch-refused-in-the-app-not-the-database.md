---
id: s14-01-own-branch-refused-in-the-app-not-the-database
prd: 2896
slice: s14
rank: medium
bears-on: none
raised: 2026-11-16
wave: 13
---

## The question, in plain words

Where should a mission in a plan repository be refused `own-branch`: in the database, or in the app's own rules?

## The decision, in plain words

In the app. The Missions tab offers no `own-branch` there, the level call and Start refuse it with `a mission branch holds one repository: use with-you or alone`, and the mission's run waits on that same line if one already sits at `own-branch`. The database has no new rule.

## The intro, for fun

One repository, one branch; a plan repository has many.

## The punchline, for fun

The door is locked in three places, the wall is untouched.

## The options, in plain words

A. Refuse in the app: the tab, the level call, Start and the run (built).
B. Add a database rule that reads the products' plan repositories.

## What I had to decide

Whether to add a migration. A plan repository is a product setting that can change after a mission is made, so a database rule would be stale anyway.

## What I did meanwhile

Built A; no migration. `omni mission` and the skill still write the level; the app refuses it on Start.

## What it costs to change later

Adding a database rule later is one migration; the app's checks can stay.

## What I could not know

(author) Whether the owner wants the refusal at brief-writing time too, which the kit cannot know without the product list.
