---
id: s3-02-concept-pr-link-is-a-search
prd: 1272
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

The concept's page links to its review on GitHub, but it does not yet know that review's number. Where should the link go?

## The decision, in plain words

The link opens GitHub's search for the review that refers to the concept's issue, which finds it in one click, until the next part of the work reads the review itself.

## The intro, for fun

The page knows the review exists, it just has not been told the room number.

## The punchline, for fun

So it points at the corridor and trusts you to read the doors.

## The options, in plain words

A. A. Link GitHub's search for the pull request that refers to the issue, until s4 reads the pull request.
B. B. Show no concept PR link until s4 reads the pull request.
C. C. Read the pull request from GitHub on the page now, ahead of s4.

## What I had to decide

Whether the header's concept PR link is a GitHub search until s4 stores the pull request, or waits to appear until then.

## What I did meanwhile

ConceptPage.view.ts links "concept PR" to https://github.com/<repo>/pulls?q=is:pr "Refs #<n>", the line /omni:think-big puts first in the concept PR's body. The page reads no GitHub; the concept's slug, which names its branch, is not stored in the dossier, so the exact branch cannot be named either.

## What it costs to change later

One line in ConceptPage.view.ts once s4 stores the pull request in fix_facts: link its url instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives the PR's facts to s4, and the dossier keeps no slug to build the branch name from.
