---
id: s4-02-care-target-default-branch
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When the care command looks after another repository's pull request, it needs that repository's main branch name, which the Omni page does not give. Where should it read it?

## The decision, in plain words

It still asks GitHub's own tool for that one name, and only for another repository: everywhere else the care command reads the Omni page alone. A bug's closing changes are now taken from the plan's own repository, as the page names them by number only.

## The intro, for fun

The map came from the new office, all but one street name.

## The punchline, for fun

For that one, we still phone the old office.

## The options, in plain words

A. A. Keep the one default-branch read on gh, for a target only (built).
B. B. Add a repository read (its default branch) to the page's contract and use it here.
C. C. Take the target's default branch from the plan repository's config instead.

## What I had to decide

care state --repo <target> read the target's default branch with `gh repo view` (scopeOf); the contract has no repository read. Built: kept on gh, called only for a target (githubEnv is no longer computed for any other round, so a session without gh reads the plan repository's care with no gh at all). `gh repo view` is not among the reads the s6 guard refuses. Also: care list's bug records come from LoopIssueDetail.closedBy, which names closing changes of the issue's own repository only (settled item s2-02), where the gh read took each change's repository from its link.

## What I did meanwhile

Tested: a target round still reads `develop` for acme/backend; a round with github.user set runs no gh.

## What it costs to change later

A repository read in the contract and one call in care.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) In a cloud session without gh, `omni care state --repo <target>` still fails on the default branch read.
- (author) A bug record PR opened in a target repository, rather than the plan repository, is no longer listed.
