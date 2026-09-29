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
