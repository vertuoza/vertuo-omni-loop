# Plan: omni sync says whether a checkout is in sync before anyone plans on it

PRD #1990, specified in `spec.md` beside this plan. The feature branch `feat/sync-status` merges
into `main` through the feature PR (Closes #1990); each slice is a sub-PR from
`feat/sync-status--<slice>` into the feature branch (Part of #1990).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni sync` runs end to end on the main check: the `sync` config block, the pure status function for all four checks and the newcomer, the main check's facts, the cache, the command and its help | `kit/lib/sync/` `kit/bin/commands/sync.ts` `kit/bin/commands/index.ts` `kit/bin/sync.test.ts` `kit/lib/help/entries.ts` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/init/config-text.ts` `kit/lib/init/config-text.test.ts` | — | 1 | deep |
| s2 | The kit check and the newcomer's setup facts: the repository's kit, the plugins and each target repository's kit against the latest release; the plugin list and the sign-in for the four steps | `kit/lib/sync/kit` `kit/lib/sync/setup` | s1 | 2 | build |
| s3 | The knowledge and page checks: stale evidence, the target copies, changed knowledge files, the sign-in and the constituents' age | `kit/lib/sync/knowledge` `kit/lib/sync/page` | s1 | 2 | build |
| s4 | `omni sync --fix` runs the safe fixes in order, prints what it left and why, and checks again | `kit/lib/sync/fix` `kit/bin/commands/sync.ts` `kit/bin/sync-fix.test.ts` | s1 | 2 | deep |
| s5 | `omni session start` prints the sync block, and the SessionStart hook refreshes in the background | `kit/bin/commands/session.ts` `kit/bin/session.test.ts` `kit/plugin/hooks/hooks.json` `kit/test/hooks-json.test.ts` `kit/lib/help/entries.ts` | s1 | 2 | build |
| s6 | The status line's badge and the HUD's row, read from the cache, with one background refresh when it is stale | `kit/lib/statusline/` `kit/bin/commands/statusline.ts` `kit/bin/statusline.test.ts` `kit/lib/now/` `kit/bin/commands/now.ts` `kit/bin/now.test.ts` `kit/plugin-hud/` | s1 | 2 | build |
| s7 | The words: the step 0 sentence of four skills and their porting notes, the guide's install and troubleshooting pages | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/yolo/` `kit/plugin/skills/mega-brainstorm/` `kit/plugin/skills/ultra-yolo/` `kit/porting/` `kit/test/skill-steps.snapshot.json` `docs/guide/install.md` `docs/guide/troubleshooting.md` | s4, s5 | 3 | light |

**Shared ground.** `kit/lib/sync/` is s1's in wave 1; in wave 2, s2 (`kit/lib/sync/kit`,
`kit/lib/sync/setup`), s3 (`kit/lib/sync/knowledge`, `kit/lib/sync/page`) and s4
(`kit/lib/sync/fix`) each own their own file family inside it, and none of them meets another.
`kit/bin/commands/sync.ts` is s1's in wave 1 and s4's alone in wave 2. `kit/lib/help/entries.ts` is
s1's in wave 1 (the `sync` entry) and s5's alone in wave 2 (the `session` entry). `kit/dist/` is
generated: no slice lists it, and the wave rebuilds it after merging.

## Per slice: done when

### s1 (deep: the status rules, the weights and the cache every other slice reads)

- `omni config sync` prints the defaults of spec section 6 without a `sync` block; the config
  refuses each invalid `order`, level and `mainRedAfter` naming its key (`kit/lib/config.test.ts`);
  the config `omni init` writes carries the block, commented.
- A pure `syncStatus(facts, config)` in `kit/lib/sync/` turns fact objects for all four checks and
  the four setup steps into findings, a status and a headline, as spec sections 2, 3 and 5 say; its
  tests cover the level caps, `off`, a custom `order`'s headline, `mainRedAfter` at 23 h 59 and
  24 h 01, a newcomer with 0 to 4 steps done, `setupDoneAt` written once and never 🔵 after it, and
  `not checked` never red.
- The main check's facts are gathered with `git` replaced by a fake in tests: the fetch within 10 s,
  the behind count and the oldest missing commit's age, the main checkout against a linked worktree,
  changed tracked files, local commits not on the remote.
- The kit, knowledge and page gatherers and the setup facts are one file each, `kit/lib/sync/kit.ts`,
  `kit/lib/sync/setup.ts`, `kit/lib/sync/knowledge.ts`, `kit/lib/sync/page.ts`, which s1 leaves
  returning `n/a` (green, `n/a · not checked yet`) and every setup step done, so s2 and s3 fill them
  without touching another file.
- `.omni-loop/local/sync.json` is written in the main checkout with the fields of spec section 4; a
  cache that does not read is rewritten; `kit/lib/sync/cache.ts` reads it with no `git`, `gh` or
  network import, for the status line and the HUD.
- `omni sync` prints the block of spec section 1; `--json` equals the cache; `--quiet` prints
  nothing; `--background` starts `omni sync --quiet` detached and returns; `--strict` exits 1 on 🔴
  only; outside an installed checkout it prints `sync: the loop is not installed here` and exits 0
  (`kit/bin/sync.test.ts`, through `main()` on a `makeRepo()` fixture with a local bare remote).
- `omni help sync` describes the command, its flags and its statuses, and the help tests pass.

### s2

- The repository's kit: `installedVersion`, or the running kit's for a shim bin, against
  `latestRelease`; older is an orange finding naming both versions, fix `omni sync --fix`.
- The plugins: `omni@omni-loop` and `omni-hud@omni-loop`'s versions from `claude plugin list`,
  against the same release; one not installed once `setupDoneAt` is written is orange with its
  install lines; no `claude` on the PATH skips this part.
- The target repositories (plan targets; the product's other repositories from the product targets
  cache): each bin's `sha` read through `gh api`, the raw file only when the `sha` changed, its
  version cached beside the `sha`; older is orange naming the repository; no kit there is orange.
- The setup facts: the two plugins installed (from the same list), the sign-in stored and not
  expired; `not Claude: skipped` without `claude`.
- Every fact is tested with `gh` and `claude` replaced by fakes, a timeout included; no test calls
  GitHub.

### s3

- Stale evidence from `omni kb status`'s `staleEvidence` is an orange finding with its count, fix
  `/omni:invade --refresh`.
- In a plan repository, each target's `staleness` from `omni targets`: `drifted` orange, `stale` red
  before the level, fix `/omni:mega-invade --refresh`; outside a plan repository this part does not
  run.
- Tracked files changed under `paths.knowledge` are an orange finding with their count.
- No page: `n/a · no Omni page`, green; no sign-in or an expired one: orange, fix `omni signin`; the
  constituents cache older than 24 hours, or the page not answering `omni constituents` within its
  3 s budget: orange, fix `omni sync --fix`.
- Tested on fixture repositories and fakes, with no call to GitHub or the page.

### s4 (deep: it changes a person's checkout)

- `omni sync --fix` runs spec section 7's five steps in order, each only when its finding is open
  and its precondition holds, prints a `✓` line for what it did and a line with why for what it
  left, then runs the checks again and prints the new status.
- On fixture repositories with a local bare remote: a fast-forward; a switch to the default branch
  on a clean tree; no switch with a changed tracked file, or with a commit its upstream lacks; a
  diverged default branch printed as `has diverged … fix it by hand` and untouched; the remote's
  refs unchanged after every run (nothing pushed).
- The plugin step calls `kit/lib/update/plugin.ts`, the kit step `omni update`, never in the kit's
  own repository; neither runs in tests (fakes).
- It never runs `omni signin`, `/omni:invade` or `/omni:mega-invade`, never merges, rebases or
  resets, and never touches a target repository.

### s5

- `omni session start` prints the sync block between the constituents and the briefing: from the
  cache when under 15 minutes old, else after running the checks within 15 s, else the cache with
  its age (`checked 2 h ago`), or `sync: not checked yet`; it exits 0 whatever happens
  (`kit/bin/session.test.ts`, with the budget and the clock injected).
- The SessionStart hook in `kit/plugin/hooks/hooks.json` gains `omni sync --background || true`
  beside `omni constituents`, and `kit/test/hooks-json.test.ts` holds it.
- `omni help session` names the sync block.

### s6

- The status line's second line starts with the badge of spec section 8 (`🟢 in sync`,
  `🟠 <headline>`, `🔴 <headline>`, `🔵 setting up <k>/4`), then ` · ` and what it says today; no
  badge without a cache; at narrow widths the headline is cut first and the dot and its first word
  always stay (`kit/lib/statusline/render.test.ts`).
- A cache older than 15 minutes, or absent, starts one `omni sync --background`, never a second
  while the lock beside the cache is held (`kit/bin/statusline.test.ts`).
- The status line reads the cache through `kit/lib/sync/cache.ts` alone: `kit/test/no-gh-reads.test.ts`
  stays green with no change to it.
- `omni now --json` carries a `sync` field (status, headline, `checkedAt`), and the HUD band's first
  row draws it as the status line does; `omni now` in a folder without the loop still answers that
  the session is on nothing and exits 0 (N-PRODUCT-12).

### s7 (light: wording only)

- `/omni:brainstorm`, `/omni:yolo`, `/omni:mega-brainstorm` and `/omni:ultra-yolo` each say at
  step 0, in one sentence, that a sync status other than 🟢 from `omni session start` is said to the
  person in one line with its fix, and the run carries on; their porting notes under `kit/porting/`
  record the change; `kit/test/skill-steps.snapshot.json` is updated and its test passes.
- `docs/guide/install.md` gains "Before you start: omni sync" (the statuses, the newcomer's four
  steps, `--fix`, the `sync` config block); `docs/guide/troubleshooting.md` gains one line per
  finding with its fix.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green on the feature branch.
