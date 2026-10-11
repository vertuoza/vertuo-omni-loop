---
id: s5-01-guide-tests-and-guard
prd: 1628
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

Adding the Cloud sessions page meant changing the guide's own tests and its checker, which sit outside the files this part of the work was given. Is it all right that they changed alongside the page?

## The decision, in plain words

The tests now expect the new page right after Join a team, and the checker now recognises a command listed beside others from one file, so the page can name the command that shows who you are signed in as.

## The intro, for fun

One new page in the guide, and two tests that count pages had to learn to count to eighteen.

## The punchline, for fun

The checker also learned that a command can share a file with its siblings.

## The options, in plain words

A. A. Change the two guide test files and the checker's command lookup alongside the page (built).
B. B. Leave them untouched and let a separate slice add the page to the tests and widen the checker, the guide's checks staying red until then.
C. C. Keep the checker as it was and avoid naming the who-am-I and sign-out commands as code on the page, against the plan's done-when.

## What I had to decide

Keep option A unless the guide's tests and checker should have been changed in a slice of their own.

## What I did meanwhile

The page, its place in the guide and its links ship with the tests and the checker updated to match.

## What it costs to change later

Undoing it is reverting a few lines in two test files and one regular expression; no data and no published behaviour depend on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gave the slice only the guide pages, so whether its tests count as part of the page is not settled anywhere (author).
