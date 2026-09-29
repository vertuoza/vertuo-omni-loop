# Settled outbox items — PRD 598

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-fallow-install-side-effects -->

## s1-01-fallow-install-side-effects — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-fallow-install-side-effects
prd: 598
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Adding the new code-quality tool changed which helper versions the GitHub App's background-jobs library links to. Is that acceptable, and should the tool's optional heavy add-on stay uninstalled?

## The decision, in plain words

The tool's optional add-on (only needed for a mode we keep off) is not installed. Installing the tool made the package manager relink the background-jobs library of the GitHub App to the newer major version of its validation helper, which it already listed as preferred.

## The intro, for fun

One new tool walked in and the furniture moved a little.

## The punchline, for fun

Nothing broke, but somebody should notice the couch is now by the window.

## The options, in plain words

A. A: Keep the relink and leave the optional add-on uninstalled (built).
B. B: Keep the add-on out, and pin the GitHub App's validation helper back to the older major version with an override.
C. C: Install the add-on too, which also links a newer type checker into the same library.

## What I had to decide

Whether the relinked helper version is fine for the GitHub App, and whether the optional add-on stays out.

## What I did meanwhile

The lockfile carries the relink; the whole test suite passes on it, and the add-on is excluded in package.json.

## What it costs to change later

A constant: pin the old link back with a package manager override, or drop the exclusion line, in one small commit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The GitHub App's live deploy was not exercised with the relinked helper; only the tests ran.
- (author) Why the package manager relinks on any dependency change was not traced; a plain reinstall on main keeps the old link.

```

<!-- /omni-outbox-settled: s1-01-fallow-install-side-effects -->

<!-- omni-outbox-settled: s2-01-hook-calls-fallow-directly -->

## s2-01-hook-calls-fallow-directly — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s2-01-hook-calls-fallow-directly -->

<!-- omni-outbox-settled: s3-01-fallow-audit-base-in-ci -->

## s3-01-fallow-audit-base-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-fallow-audit-base-in-ci
prd: 598
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The code-quality check on a pull request needs something to compare against. Should it compare against the branch the pull request goes into?

## The decision, in plain words

The check compares each pull request against the branch it targets, so it only judges what the pull request itself changes, and the job downloads the full history so that comparison is possible.

## The intro, for fun

Every judge needs a before picture to spot what changed.

## The punchline, for fun

We handed it the whole photo album, just in case.

## The options, in plain words

A. Compare against the target branch, with full history (built).
B. Fetch only the target branch at a shallow depth, cheaper but fragile when the branch is far behind.
C. Let the tool guess its base from the checkout, which on a shallow checkout grades nothing reliably.

## What I had to decide

The spec says the audit fails only on findings the change introduces but does not say how CI finds the base; a shallow checkout has no base branch to compare with.

## What I did meanwhile

The fallow job checks out with full history and sets FALLOW_AUDIT_BASE to origin/<base ref>; locally the audit against the feature branch passes.

## What it costs to change later

A constant: two lines of the workflow.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not yet run on GitHub; the first ready feature PR proves it.

```

<!-- /omni-outbox-settled: s3-01-fallow-audit-base-in-ci -->
