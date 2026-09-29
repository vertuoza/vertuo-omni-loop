---
id: s3-01-stage-events-default-branch-shapes
prd: 587
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Should the instant stage updates follow each repository's own branch naming, or is the standard naming enough?

## The decision, in plain words

The instant updates recognise only the standard branch names. A repository that renamed its branches still gets its stages, but only from the check every 15 minutes.

## The intro, for fun

A branch by any other name would still merge as sweet.

## The punchline, for fun

The quick messenger only knows the common names; the slow one knows them all.

## The options, in plain words

A. Kit default shapes in the webhook; custom-shaped repositories rely on the sync (built).
B. Read the base branch's config through the GitHub App in the webhook before matching.
C. Move the forward into an Inngest function that reads the config, then POSTs.

## What I had to decide

Whether the app should read each repository's own branch names before telling galaxy about a stage.

## What I did meanwhile

omni-app matches pull request branches against the kit's default shapes and link lines. Repositories with custom shapes get stages from the 15-minute sync only.

## What it costs to change later

Switching to the repository's own shapes means one config read from GitHub per pull request event, in the webhook or in a small Inngest function; the matcher already takes the shapes as an argument.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many workspace repositories customise branches.* is not known (author)
