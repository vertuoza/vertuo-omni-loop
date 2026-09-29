---
id: s2-01-hook-calls-fallow-directly
prd: 598
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Should the commit guard run the project's shared audit shortcut, or call the same audit tool itself so it can read a clear pass or fail answer?

## The decision, in plain words

The guard calls the audit tool itself, with the same settings and the same saved starting point as the shortcut, and asks it for a machine-readable answer so it can tell a real failure from a crash.

## The intro, for fun

The spec said to ring the front doorbell; the guard walked in through the side door instead.

## The punchline, for fun

Same house, same rules, it just gets to read the note on the fridge.

## The options, in plain words

A. Call the audit tool itself and ask for a machine-readable answer (built): it tells a real failure from a crash, with the same settings as the shortcut.
B. Run the shared shortcut and judge only by whether it succeeded: literal to the spec, but a crash and a real finding look the same.
C. Run the shared shortcut and pass it the machine-readable flag: keeps the clear answer, but adds a slower start to every commit and push.

## What I had to decide

Whether the hook must go through `pnpm fallow:audit` literally, or may call the pinned `fallow audit` binary with `--format json --quiet --explain --gate-marker agent` as vnext's hook does.

## What I did meanwhile

The hook resolves fallow (PATH, then ./node_modules/.bin, then npx --no-install) and runs `fallow audit --format json --quiet --explain --gate-marker agent` from $CLAUDE_PROJECT_DIR. It reads the same .fallowrc.jsonc and baselines as `pnpm fallow:audit`, so a commit it passes is one the `checks / fallow` job passes.

## What it costs to change later

A constant: swapping the runner line for `pnpm --silent fallow:audit --format json ...` is a one-line change. Going through pnpm would also shadow the test's stub fallow with node_modules/.bin, so the verdict tests would need a different seam.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the spec's wording meant the literal script or only the same audit was not asked of the person who wrote it (author)
