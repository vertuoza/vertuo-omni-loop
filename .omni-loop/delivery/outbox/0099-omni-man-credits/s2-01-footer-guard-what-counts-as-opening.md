---
id: s2-01-footer-guard-what-counts-as-opening
prd: 99
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

How does the automatic check tell that a skill opens a pull request or an issue, and so must end it with the loop's signature line?

## The decision, in plain words

A skill counts when it runs the command that opens one, rewrites a description, or says in words that it opens one. A skill that only posts comments is left alone, since comments are never signed.

## The intro, for fun

A check that reads instructions has to decide what counts as opening a door.

## The punchline, for fun

Knocking is a comment; walking in is a pull request.

## The options, in plain words

A. Count a skill as opening one when it runs the opening command, rewrites a description, or says in words that it opens one, the option built.
B. Count only a skill that runs the opening command itself, so a skill that hands the opening to another skill is not held to the rule.
C. Hold every skill to both signature lines, whatever it does, and stop reading its words.

## What I had to decide

What the new rule in `kit/test/plugin.test.mjs` treats as "a SKILL.md that opens a pull request or an issue" (spec, Acceptance criteria 5; the plan's s2 "done when"). The spec lists the bodies that are signed and says a body a skill rewrites later keeps its footer, but not how a guard reading skill prose recognises them. `/omni:plan`, `/omni:terraform` and `/omni:do-work` open their pull requests through `/omni:pr` and never name `gh pr create` themselves, so a guard that reads commands alone would not hold them to the rule.

## What I did meanwhile

The guard counts a SKILL.md as opening one when it names `gh pr create` or `gh issue create`, rewrites a body with `gh pr edit … --body`, or says "open(s) it/the/a … PR, pull request or issue" in prose, across a line break (a phrase with "in" or "on" before the noun is skipped, so "opens the question in the pull request's outbox comment" is no opening). `gh pr comment` and `gh issue comment` count for nothing. All eight skills name `omni sign footer`, so the live check passes; fixture skills in the same file show each way in, the comment-only case, and a skill dropping either line.

## What it costs to change later

Three regular expressions and their fixture cases in `kit/test/plugin.test.mjs`; no skill's prose changes. Narrowing the rule to commands only stops holding `/omni:plan`, `/omni:terraform` and `/omni:do-work` to it; holding every skill to both lines unconditionally needs no skill change today, since all eight already name both.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say how the plugin guard recognises a skill that opens a pull request or an issue, nor whether rewriting a body counts as opening one; it says only that a rewritten body keeps its footer.
- (author) A future skill that opens a pull request in other words ("create a pull request", "raise a PR") would escape the prose rule; the guard reads the verb "open" only.
