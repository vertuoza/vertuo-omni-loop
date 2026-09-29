---
id: s2-01-sync-off-until-galaxy-address-set
prd: 587
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The scheduled sync needs to know where the app lives. Should it stay switched off until someone gives it that address?

## The decision, in plain words

Yes: the sync stays off until the app's address is set as a repository setting, then it runs every 15 minutes and fails loudly on a wrong secret.

## The intro, for fun

The alarm clock was ready to ring every 15 minutes, but nobody had told it which door to knock on.

## The punchline, for fun

So it sleeps politely until someone writes the address on the fridge.

## The options, in plain words

A. Keep the sync off until the app's address is set as a repository setting, the option built.
B. Write the production address in the workflow, so it runs as soon as the secret is set.

## What I had to decide

How .github/workflows/stages.yml learns galaxy's URL, and what it does before that is set. The spec names only the bearer secret.

## What I did meanwhile

The job runs only when the repository variable GALAXY_URL is set (like the releases workflow's SUPABASE_PROJECT_ID gate); it posts to that URL's /api/stages/sync and fails on any non-2xx reply. The README's deploy table lists GALAXY_URL and STAGES_SYNC_SECRET.

## What it costs to change later

One line in the workflow: hard-code the production URL instead, or gate on something else.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the production galaxy host should be written in the workflow itself instead of a variable.
