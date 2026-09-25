---
id: s8-05-what-ties-a-bug-to-the-prd
prd: 72
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Fourteen days after the merge, which bug reports count against the request, when is one fixed, and when is its fix tied to code that was rewritten again and again?

## The decision, in plain words

A bug report counts when it carries the bug label, was opened within the fourteen days and names the request's number, and it is fixed when a change merged into the main line in those days says it closes it. That fix is tied to the rewritten code when the lines it changed fall inside such a stretch, or when it changed that file and the code host did not say which lines.

## The intro, for fun

Every bug report claims a parent, and the retro checks the paperwork.

## The punchline, for fun

It wants the number in writing, and a fix that says so out loud.

## The options, in plain words

A. A fix is a merged change that says it closes the bug, tied to the rewritten code by the lines it changed, the option built.
B. Also count changes linked to the bug by hand on its page, reading each bug's history.
C. Tie a fix to the rewritten code by the file alone, whatever lines it changed.

## What I had to decide

The spec counts `bug` issues whose title or body names `#<prd>`, created within fourteen days of the merge, fixed or not, and marks a fix touching a churn range as linked. It does not say how a fix is found, nor how touching a range is measured.

## What I did meanwhile

A fix is a pull request merged into `repo.defaultBranch` within the window whose title or body closes the bug with GitHub's closing words (`fixes #40`, `resolves owner/repo#40`, or the issue's URL). Touching compares the fix's change blocks, on its own base, with each churn range of the same file (or of the file it was renamed from); a file GitHub sent without a patch is linked by the file alone. A bug counts as closed when it was closed within the window.

## What it costs to change later

A small change in `kinds/after-merge.mjs` only: reading each bug's timeline to add fixes linked by hand, or dropping the line check for a file check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The fix's line numbers are read on its own base, which may have moved since the merge: a range can be missed, or matched, by a few lines.
- (author) A fix linked only from the issue's sidebar, or merged into a branch other than the default one, is not found.
