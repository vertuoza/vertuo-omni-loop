---
id: s1-03-target-finding-names
prd: 1130
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

A finding about another repository needs a name that cannot clash with the same kind of finding in the plan repository. Is prefixing it with that repository's short name, and its title with the repository's full name, the right way?

## The decision, in plain words

A finding about another repository has the repository's short name in front of its name and its full name in front of its title, and all findings are ranked together, most severe first.

## The intro, for fun

Two repositories can both have a slow slice called s3.

## The punchline, for fun

Now each slow slice wears a name tag, so nobody mixes up whose it is.

## The options, in plain words

A. A. Prefix the name with the short repository name and the title with the full one, ranked across repositories, as built.
B. B. Keep the names as they are and number the findings within each repository.
C. C. Prefix the name only, and leave the title for the issue to name the repository.

## What I had to decide

How a finding about another repository is named and titled, and whether findings are ranked across repositories or within each one.

## What I did meanwhile

The retro groups the findings by repository on the page, while their numbering stays ranked by severity across all of them.

## What it costs to change later

Small while no multi-repository retro has run; afterwards, a rename would open new issues for findings already filed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The next slice titles the issues; whether it keeps this title prefix is not settled yet (author).
