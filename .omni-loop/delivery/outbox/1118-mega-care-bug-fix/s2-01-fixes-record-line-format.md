---
id: s2-01-fixes-record-line-format
prd: 1118
slice: s2
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

When one bug is fixed in several repositories, how does its record show which reproduction and which guard belong to which repository, and what does the check skip?

## The decision, in plain words

Each repository gets its own line in the reproduction and guard parts, starting with its name in bold, short or full. Because the reproductions live in the other repositories, the check no longer looks for a reproduction file in the plan repository.

## The intro, for fun

The spec asked for one line per repository and left the shape of the line to whoever writes it.

## The punchline, for fun

So every line now wears a name tag.

## The options, in plain words

A. A. A bold name per line, either name accepted, File and Red not checked with a Fixes table, Mutation not checked per repository
B. B. The same, but Mutation also needs one line per repository
C. C. A second table instead of lines, one column per part

## What I had to decide

The shape of a per-repository line in a multi-repository bug record, and which single-repository checks it skips.

## What I did meanwhile

Lines read as `- **<name or owner/name>:** text`; table cells take either name; a pull request is `#n`, `owner/name#n` or its link and must be in the row's repository; with a Fixes table the File and Red lines are not checked; the Mutation part is not checked per repository.

## What it costs to change later

One small parser in the bug check and its tests; the bug-fix skill built later writes to whatever shape this check reads.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says one line per repository but not its shape (author)
- The spec skips only the changed-file check; the file-exists and Red checks were skipped too, since the file lives in another repository (author)
- The spec lists Mutation among the per-repository parts, but the plan's done-when checks only Reproduction and Guard (author)
