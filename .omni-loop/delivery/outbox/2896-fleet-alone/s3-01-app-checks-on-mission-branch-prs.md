---
id: s3-01-app-checks-on-mission-branch-prs
prd: 2896
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

The spec says the app's own checks (outbox, budgets, business laws) run on a pull request into a mission branch as on one into main. Which slice changes the webhook that decides this?

## The decision, in plain words

Only the checks workflow runs for pull requests into a mission branch in this slice. The app's own checks still skip them, because the webhook that picks pull requests lies outside every slice's territory.

## The intro, for fun

The guard at the main gate does not yet know the side door has a number.

## The punchline, for fun

Until someone tells the webhook, the side door is checked by the workflow alone.

## The options, in plain words

A. A. Leave the webhook; a later slice adds mission branches to its filter (built).
B. B. Add the filter now, in this slice, outside its territory.

## What I had to decide

Which later slice adds the mission branches to the webhook's list of pull requests that get the app's checks.

## What I did meanwhile

The checks workflow runs on pull requests into mission branches; the webhook is left as it is.

## What it costs to change later

Changing the webhook later costs one small filter and its tests, in a slice whose territory lists the webhook.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No slice's territory names the webhook file (author).
