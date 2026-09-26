---
id: s3-02-credits-other-github-failures
prd: 99
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When GitHub fails the record for a reason other than a missing tool, a lost login or a speed limit, should the kit stop with one plain line, or carry on with what it could read?

## The decision, in plain words

If a search fails for any reason, the kit stops and says so in one line, the same way it does for the three failures the design names. If only one pull request, named by a signed commit, cannot be opened, the kit counts the rest and warns about that one.

## The intro, for fun

Sometimes GitHub just says no and does not say why.

## The punchline, for fun

Half a record would look like a whole one, so it stops.

## The options, in plain words

A. A. Any failed search stops the run with one line and exit 2; a pull request a signed commit names that cannot be opened is a warning, the option built.
B. B. Any failed search is a warning, and the report prints with what was read.
C. C. Any failure at all, the single pull request included, stops the run with exit 2.

## What I had to decide

What `omni credits` does when `gh` fails in a way the spec does not name. The spec (`omni credits`, and AC 10) says a missing or logged-out `gh`, or a rate limit, exits 2 with one line saying so. It says nothing of any other failure: a server error, a network cut, or a `(#<n>)` in a signed commit's subject that names an issue or a pull request the login cannot see.

## What I did meanwhile

`kit/lib/credits/reader.mjs` (`unreadable`): any other failed search is a `GitHubUnreadable` with reason `failed`, and `omni credits` exits 2 with one line, `omni credits: gh failed: <gh's first line>`, printing no report. A `gh pr view` of a pull request a signed commit names that fails that way is a warning (`<repo>#<n>, named by a signed commit, could not be read: …`) and that pull request is not counted; a missing or logged-out `gh` or a rate limit there still stops the run. Tested in `kit/lib/credits/reader.test.mjs` (the when gh cannot be read block, and the what it keeps block).

## What it costs to change later

One branch in `kit/lib/credits/reader.mjs`: a failed search could become a warning like the view does, or the view a stop like the searches. The exit code is the only contract a caller reads; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names three ways `gh` cannot be read and says nothing of any other failure, nor of a merged-by number that is not a readable pull request.
