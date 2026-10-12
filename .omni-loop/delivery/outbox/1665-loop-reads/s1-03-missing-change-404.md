---
id: s1-03-missing-change-404
prd: 1665
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

When the kit asks for a change the repository does not have, the page answers not found, which the kit also reads as a page that cannot read the loop yet: how should the kit tell the two apart?

## The decision, in plain words

The page answers 'not found' with its own words, naming the change and the repository, so the kit can tell it from a page that has no such reads at all.

## The intro, for fun

Two kinds of nobody home: the house is empty, or there is no house.

## The punchline, for fun

The page leaves a note on the door saying which one it is.

## The options, in plain words

A. Answer 404 with the plain words naming the change; the kit tells it from a missing route by the words.
B. Answer 200 with no change, and let the kit say nothing was found.
C. Answer another status for a missing change, kept apart from a missing route.

## What I had to decide

What GET /api/loop/changes/<n> answers for a number with no pull request: 404 `{error: 'No change <n> in <repo>.'}` (built), or another status, given the spec maps a bare 404 to `refused (404): this Omni page cannot read the loop yet`.

## What I did meanwhile

Answered 404 with the plain words 'No change <n> in <repo>.'; a page without the routes answers Next's own 404, without a JSON `error`. s3's adapter can print the `error` when one is there and the spec's line otherwise.

## What it costs to change later

A constant in the controller and one test, before the kit reads it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3 already plans to read the error words on a 404. (author)
