---
id: s4-01-day-14-falls-back-on-the-merge-verdict
prd: 487
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

Fourteen days after a merge the retro asks the judge again. If the judge cannot be reached that day, should the retro keep the answer it got at the merge, or count as not judged?

## The decision, in plain words

It keeps the answer from the merge, the same way it already keeps the merge's words. And when the later run is worth a pull request while the first was not, it also opens the issues for the first run's kept findings, which never got any.

## The intro, for fun

Two weeks later the judge is out for lunch.

## The punchline, for fun

So the retro goes with what the judge said last time.

## The options, in plain words

A. A failed day-14 call keeps the merge run's verdict with its words, and a late PR also opens the first run's kept issues; the option built.
B. A failed day-14 call counts as not judged: the comment is rewritten and nothing is added to an open PR.
C. Keep the merge verdict, but open issues at day 14 only for the day-14 run's own findings.

## What I had to decide

The spec says the day-14 run is judged the same way on both runs' findings, and that no verdict means no PR. It does not say what the day-14 run does when its own model call fails, nor whether the merge run's kept findings get issues when only the day-14 run opens a PR.

## What I did meanwhile

At day 14, `prose = guarded.prose ?? earlier.prose`, as before, and the verdict comes with those words: a failed day-14 call acts on the merge run's verdict (a merge run with an open PR gets its After merge commit; a quiet merge run's comment is rewritten). When the day-14 run is worth it and the merge run opened no PR, its issues are published over both runs' findings (kept ones only, merge run's first); otherwise over its own. A "no new lesson" comment left by the merge run stays as it is when day 14 opens the PR.

## What it costs to change later

A constant: dropping the fallback is one expression in the retro function, and the issue range is one condition.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) When day 14 opens the PR after a quiet merge run, the earlier verdict comment is left in place and now disagrees with the PR; the spec does not say whether to rewrite or delete it.
- (author) Issues over both runs are ranked merge run first, not worst first across both runs.
