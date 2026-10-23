# Bug 2442: omni harvest crashes on a pull request with many changed files

## Triage

- **Domain:** kit · `omni harvest` (the terminal command)
- **Risk:** medium — a person running the harvest by hand on a large merged pull request gets a crash and no knowledge; the Omni App's harvest reads the files through Octokit and is not affected
- **Regression:** new bug — no evidence this ever worked on a pull request this size

## Reproduction

- **File:** `kit/bin/harvest.test.ts`
- **Level:** unit
- **Red:** Error: spawnSync gh ENOBUFS

## Fix

`omni harvest` reads a merged pull request's files with `gh api … --paginate --slurp`, every page
printed at once, through execFileSync and its 1 MB default buffer; on #2307 (1,172 files) the list
was larger and the command crashed. Its `gh` calls now take a 64 MB buffer, as the kit's other
commands that read large outputs do.

## Guard

The reproduction: a `gh` faked as execFileSync answers, refusing past the call's buffer, over a file
list of about two megabytes; it fails again if the buffer is dropped.

## Mutation

mutation: no changed core file against origin/main (8661c1bc): nothing to mutate
