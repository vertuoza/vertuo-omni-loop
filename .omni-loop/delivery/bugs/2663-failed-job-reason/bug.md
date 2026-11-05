# Bug 2663: a failed job on the Runners page does not say why

## Triage

- **Domain:** Runners page
- **Risk:** medium — anyone sending a job to a runner sees Failed with no reason, and the only workaround is reading the runner's own log on its machine (Jev, 0.95)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/runners/page/render.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected '>/omni:wave 1 widgets @you ada-laptop…' to contain 'Failed omni plugin v0.0.1 is older th…'

## Fix

The job row drew the status alone: the reason the runner reported was stored and returned to the page, but never displayed, and a job that fails before its session starts has no log for the Terminal to show. The row now shows the reason under Failed, except `runner lost` and `timeout`, which the status already says.

## Guard

The reproduction and the `failedWhy` unit tests: they fail if the row stops showing the reason, repeats a reason the status says, or shows one on a job that did not fail.

## Mutation

mutation: no changed core file against origin/main (c383955b): nothing to mutate
