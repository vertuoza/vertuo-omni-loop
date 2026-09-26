---
id: s4-01-credits-app-items-counted-apart
prd: 99
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When the loop's own GitHub app opens an issue or a pull request, should the record count it with the loop's other pull requests and PRD issues, or on a line of its own?

## The decision, in plain words

Whatever the app opened is counted on a line of its own, marked as by the app, and never inside the pull request or PRD issue counts. It never decides when signing started in a repository either.

## The intro, for fun

The app and the skills work for the same hero, but they keep separate timesheets.

## The punchline, for fun

Nobody gets counted twice at the same party.

## The options, in plain words

A. Count what the app opened on its own line only, never in the pull request or PRD issue counts, the option built.
B. Also count what the app opened in the pull request and PRD issue counts, with a by-the-app share in each breakdown.
C. Count what the app opened in the pull request and PRD issue counts only when a loop label or the signature also says it is the loop's.

## What I had to decide

Where `omni credits` counts an issue or a pull request the signature's bot account opened (spec, `omni credits`: What it reads, Whose it is, and the signature table's `by the app`). The spec's example prints `Opened by the app: 9 issues` on a line of its own, and its `PRs` and `PRD issues` breakdowns (`signed · before signing · missed`) add up to their totals with no `by the app` share. It does not say whether an item the app opened that also carries a loop label, or any pull request the app opened, counts in those lines too, nor whether it can mark a repository's first signed item.

## What I did meanwhile

`kit/lib/credits/classify.mjs`: an item whose author is the bot account (`<slug>[bot]`, or `app/<slug>` as `gh pr view` prints it) gets the reason `author` and the signature `by the app`, which wins over `signed`, `before signing` and `missed`. `summarize` counts it under `byTheApp` (issues and pull requests apart), never in `prs`, `prdIssues`, `byRepo` or `byMonth`, and `withSignatures` never takes it as a repository's first signed item. A pull request the app opened and closed without merging is not counted, like any other. `kit/lib/credits/report.mjs` prints `Opened by the app: <n> issue(s)`, adding ` · <m> pull request(s)` when there are any. Tested in `kit/lib/credits/classify.test.mjs` (the opened by the app and summarize blocks) and `kit/lib/credits/report.test.mjs`.

## What it costs to change later

A few lines in `summarize` and one in `withSignatures` (`kit/lib/credits/classify.mjs`), and their tests. Nothing is stored: the next run simply counts the other way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether an item the app opened is also counted in the pull request and PRD issue lines, nor whether it can mark the start of signing in a repository.
