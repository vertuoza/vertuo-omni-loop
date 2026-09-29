---
id: s3-01-pull-request-see-all
prd: 698
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When someone has more than ten pull requests or reviews in the chosen period, where should the see all link under those lists take you? The spec names where see all goes for PRDs and fixes, but not for pull requests.

## The decision, in plain words

See all opens a GitHub search of that person's pull requests (or reviews) across the workspace's tracked repositories. It does not narrow to the chosen period.

## The intro, for fun

Ten pull requests fit on the page. The eleventh needs somewhere to go.

## The punchline, for fun

For now it goes to GitHub, which never runs out of room.

## The options, in plain words

A. A GitHub search of their pull requests or reviews in the tracked repositories (what is built).
B. The Engineering board for the same period, which lists everyone, not only this person.
C. No see all under these two lists: ten rows and a line saying more exist.

## What I had to decide

Where see all under the profile's pull requests and reviews should lead.

## What I did meanwhile

It opens GitHub's search, for that person, over the tracked repositories.

## What it costs to change later

One address to change in the profile module; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person would rather stay in the app, on an Engineering page filtered to that person, which does not exist yet (author)
