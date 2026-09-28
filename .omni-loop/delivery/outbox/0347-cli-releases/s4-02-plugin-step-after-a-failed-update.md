---
id: s4-02-plugin-step-after-a-failed-update
prd: 347
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When bringing the repository up to date fails, should the update still refresh the Claude plugin on the person's machine?

## The decision, in plain words

No: the plugin is refreshed only when the repository step went through, whether it opened a pull request, found one open, or found nothing to do. A failed run changes nothing, and the person reruns it once the cause is fixed.

## The intro, for fun

The repository tripped on the stairs, so should the plugin still take the elevator up?

## The punchline, for fun

For now everyone waits at the bottom together.

## The options, in plain words

A. Refresh the plugin only when the repository step exited 0 (built).
B. Refresh the plugin after every repository step that got past finding the target, whatever its exit code.
C. Refresh the plugin on every run, even when the target could not be found.

## What I had to decide

Whether omni update skips the plugin step when the repository step exits non-zero (an unknown target, GitHub out of reach, a config.yml that fails, a failed push).

## What I did meanwhile

The plugin step runs after the repository step only when it exited 0; up to date and from the kit's source count as 0. A failed repository step leaves the plugin alone, and omni update exits with the repository step's code.

## What it costs to change later

A constant: one condition in kit/bin/commands/update.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a plugin that did not update stops nothing, and that the pull request is already open by then; it does not say what happens to the plugin when the repository step itself fails.
