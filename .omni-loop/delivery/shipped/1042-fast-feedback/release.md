---
prd: 1042
title: Checks that answer in seconds, not minutes
---
Agents building this repository now check a change in seconds: one command typechecks, lints and tests
only what moved, and audits it against its base. Typechecking runs on the native TypeScript compiler,
and pull requests run their tests and lint in parallel shards.
