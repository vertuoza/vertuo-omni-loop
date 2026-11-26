# Bug 3328: the Supervisor never answers chat: its tools are refused outside a repository

## Triage

- **Domain:** kit launcher (`kit/lib/launch/launch.ts`) · the Supervisor's seat (`kit/lib/runner/supervisor-think.ts`)
- **Risk:** high — every owner with a Supervisor seat gets no chat answer and no notification: the seat thinks and spends tokens but has no tools, with no workaround
- **Regression:** new bug — no evidence this ever worked (the seat shipped in #3284, v0.0.717)

## Reproduction

- **File:** `kit/lib/launch/launch-seat.test.ts` (moved there unchanged after the red, from `kit/lib/launch/launch.test.ts`, the proof file of N-PRODUCT-12)
- **Level:** unit
- **Red:** `AssertionError: expected { kind: 'refuse', …(1) } to deeply equal { kind: 'self' }` — `"message": "omni: no Omni Loop kit here — run omni init in your repository"`

## Fix

The seat's think starts Claude Code in `~/.omni-supervisor`, a folder of its own that is no repository, with `omni supervisor mcp` as its tools server. The launcher ran only `init`, `help`, `version`, `now` and the ask hooks outside a repository, so it refused `supervisor`, the tools server closed at once, and the seat had no tools. The launcher now runs `supervisor` with no kit (it names its Omni page with `--page`) and, like `runner`, as the runner's own copy, never handed over to a checkout's bin.

## Guard

`kit/lib/runner/supervisor-think.test.ts` › "starts a tools server the omni launcher runs in the think's own folder": it hands the exact MCP command the think builds, in the think's own folder, to the launcher, so a change to either side that refuses the seat's tools fails it (red without the fix, green with it).

## Mutation

mutation: no changed core file against origin/main (d0b7fd5e): nothing to mutate
