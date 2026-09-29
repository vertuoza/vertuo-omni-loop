---
id: s1-03-no-access-read-from-the-app
prd: 612
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

How does the Repositories page know the Omni App cannot read a repository, before the collector has even tried?

## The decision, in plain words

Each time the page opens, it asks GitHub which repositories the Omni App can see; a listed repository missing from that answer shows that the App has no access. When GitHub cannot be asked, the page shows the list without those marks.

## The intro, for fun

The page knocks on GitHub's door before the collector does.

## The punchline, for fun

Whoever does not answer gets a polite sticky note.

## The options, in plain words

A. The App's live listing on each page load, the option built.
B. Only the collector's recorded error, so the page calls GitHub only for Add repository.

## What I had to decide

Where the no-access mark on Settings → Repositories comes from: the App's live listing of its installation's repositories, read on each page load, or the collector's recorded error.

## What I did meanwhile

The live listing, read server side with galaxy's App credentials. The collector's error shows separately as a failed collection being retried. A workspace with no installation shows the install link above its list, which stays visible.

## What it costs to change later

A second source is a few lines in the page's read; meanwhile one more GitHub call per page load.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether one GitHub call per page load matters at the workspace's scale (author)
