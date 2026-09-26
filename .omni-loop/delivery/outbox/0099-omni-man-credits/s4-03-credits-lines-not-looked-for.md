---
id: s4-03-credits-lines-not-looked-for
prd: 99
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When a repository has switched signing off, or its signing address belongs to no GitHub account, what should the record show for the counts only a signature can find?

## The decision, in plain words

The record leaves out what it never looked for rather than printing zeros: with signing off, the PRD issues count stands alone and the app and co-authored commit lines go. With an address that names no account, only the app line goes.

## The intro, for fun

A zero you counted and a zero you never looked for look exactly the same on paper.

## The punchline, for fun

So the record leaves a gap instead of telling a small lie.

## The options, in plain words

A. Leave out what was not looked for, the option built.
B. Print every line, with zeros where nothing was looked for.
C. Print every line, saying it was not looked for in place of a count.

## What I had to decide

What `omni credits` prints for the lines slice s4 adds when the signature cannot find them. The spec says that with `signature: null` the pull requests and issues are still counted by label and the signature line reads `signing is off in this repository` (`omni credits`, What it prints). It names no rule for the PRD issues breakdown, `Opened by the app` or `Co-authored commits on default branches` then, nor for a signature whose address is not a noreply address, which names no bot account (`botLogin` returns `null`).

## What I did meanwhile

`kit/lib/credits/report.mjs`: with signing off the PRD issues line is `PRD issues <n>` with no breakdown, and the `Opened by the app` and `Co-authored commits on default branches` lines are left out; with signing on but no bot account, only `Opened by the app` is left out. `kit/lib/credits/reader.mjs` runs no author search when there is no bot account. Under `--json`, `totals.byTheApp` and `totals.commits` are `null` when they were not looked for, and `commits` is `[]`. Tested in `kit/lib/credits/report.test.mjs`, `kit/lib/credits/reader.test.mjs` and `kit/bin/credits.test.mjs` (the signature null cases).

## What it costs to change later

Two conditions in `creditsReport` (`kit/lib/credits/report.mjs`), the matching `null`s in `summarize`, and their tests. Nothing reads the text back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says what the signature line reads with signing off, but not what the PRD issues breakdown, the app line or the commits line do then, nor what happens when the signing address names no GitHub account.
