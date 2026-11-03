# Bug 2613: a fresh worktree has no dependencies and no declared Supabase CLI

## Triage

- **Domain:** repository setup and git hooks
- **Risk:** medium — anyone working in a new worktree, agents on runners most, gets a refused commit or an `omni` that does not start; running `pnpm install` by hand is the workaround (Jev, 0.95)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `scripts/fresh-worktree.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected [] to deeply equal [ Array(1) ]

## Fix

Each worktree has its own `node_modules`, and nothing installed them after the first checkout. `.githooks/post-checkout` now installs a worktree `git worktree add` just made. A worktree Claude Code makes for a subagent runs no git hook (tried in a scratch repository, Claude Code 2.1.317), so `.omni-loop/bin/omni.mjs` also installs what is missing before its first command. The Supabase CLI is a dev dependency at the version the workflows pin, with no build script to allow, and the setup docs say so.

## Guard

`scripts/fresh-worktree.test.ts` runs the hook and the bin for real with a stand-in `pnpm`, and holds the Supabase dev dependency equal to the workflows' pin.

## Mutation

not run — the fix touches no delivery core file
