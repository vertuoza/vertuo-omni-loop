# ADR-0071 — A slice that changes code the GitHub app bundles rebuilds and commits the app's bundles as a generated change

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #1089 · **Decided:** nobody — adopted when raised (medium), 2026-10-06 · **Merged:** @pierrederval, 2026-10-06, PR #1090

## Context

Changing kit/lib/config.ts makes apps/omni-app/api/github.mjs and apps/omni-app/api/inngest.mjs stale: apps/omni-app/src/vercel-functions.test.ts fails until node apps/omni-app/build.ts rebuilds them. The plan's territory for s1 lists kit/dist/omni.mjs but not these two. I rebuilt and committed them in s1, a generated change only, so the preflight is green. Later slices that touch what the app bundles (s3's plan grading, say) will meet the same.

## Decision

When a slice changes shared code the GitHub app carries, such as the config reader, it rebuilds the app's bundled files with the app's build and commits them in their own generated-only commit, even if the plan's territory does not list them.

The option chosen: A. Keep it: the slice that changes the shared config reader rebuilds the app's bundles too, as a generated change.

## Consequences

Nothing to undo: they are a build output; a later slice rebuilds them again. The plan's shared-ground note could name them for s3 and s6.

## Source

`.omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md`, entry `s1-03-app-bundles-outside-territory`
