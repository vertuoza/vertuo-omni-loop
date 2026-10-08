# Plan: the session HUD

PRD #1208, spec beside this plan (`spec.md`). The feature branch `feat/session-hud` merges into
`main` through the feature PR, whose body says `Closes #1208`. Each slice is a sub-PR from
`feat/session-hud--<slice>` into the feature branch, whose body says `Part of #1208`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni now [--json]` names the PRD this session is on, its stage and the slices being built. Covers: the session's folder and id (`--stdin`, `--session`, `CLAUDE_CODE_SESSION_ID`); the PRD from the branch, else from a record of PRD 324's shape; the stage with `building` while a slice is not merged; the cached board keeping each slice's name (the plan's slice column, cut at the first full stop) and `omni now` naming the slices in flight and stuck; the plain and JSON outputs of the spec; exit 0, nothing on stderr, no network; the command's help entry | `kit/lib/now/` `kit/bin/commands/now.ts` `kit/bin/commands/index.ts` `kit/bin/now.test.ts` `kit/lib/statusline/board-cache` `kit/lib/help/` | — | 1 |
| s2 | A session on a bug fix or a visual fix shows it. Covers: the record widened to `{ kind, number, at }` with PRD 324's shape still read as kind `prd`; `omni bug <n>`, `omni visual <n>` and `omni dossier push <n> --kind bug` or `--kind visual` writing their kind; `omni now` reading a fix from the record or, through the heartbeat's `findWork`, from a fix branch; the fix stage (`in progress`, `merged`; `fix PR open` once links exist) | `kit/lib/now/` `kit/lib/statusline/sessions` `kit/lib/statusline/schema` `kit/bin/omni.ts` `kit/bin/omni.test.ts` `kit/bin/now.test.ts` | s1 | 2 |
| s3 | A session driving a loop or a roadmap shows it as the headline, with the PRD of its current step and what it is doing. Covers: `omni loop push tick` keeping `last` in `loop.json` and `omni loop push start` keeping `roadmap`; a `loop.json` without them still read; `omni roadmap check <n>`, `omni roadmap push <n>` and `omni next --roadmap <n>` writing a `roadmap` record; the headline (live or sleeping loop only), the roadmap's `<m>/<k> merged`, the work from the last tick, and `doing` | `kit/lib/now/` `kit/lib/loop/` `kit/bin/commands/loop.ts` `kit/bin/loop.test.ts` `kit/bin/omni.ts` `kit/bin/omni.test.ts` `kit/bin/now.test.ts` | s2 | 3 |
| s4 | `omni now` lists the links of what the session is on. Covers: `omni statusline --refresh` taking a kind and writing `links-<kind>-<n>.json` (PRD page, feature PR, phase-0 PR while open; fix page and fix PR; loop page) under PRD 324's lock and timings; `omni roadmap push <n>` keeping the roadmap page it printed; links missing or over 10 minutes old left out; `fix PR open` for a fix with an open PR | `kit/lib/now/` `kit/lib/statusline/board-cache` `kit/bin/commands/statusline.ts` `kit/bin/statusline.test.ts` `kit/bin/commands/roadmap.ts` `kit/bin/roadmap.test.ts` `kit/bin/now.test.ts` | s3 | 4 |
| s5 | The status line's second line is drawn from `omni now`, for every kind. Covers: the six lines of the spec; the headline form `roadmap <r> · <m>/<k> merged · now PRD <n> · <slice>`; the width cut on slice names, then the topic; `NO_COLOR`; the refresh started for the links as for the board; line 1 unchanged | `kit/lib/statusline/render` `kit/lib/statusline/which-prd` `kit/lib/statusline/facts` `kit/bin/commands/statusline.ts` `kit/bin/statusline.test.ts` | s4 | 5 |
| s6 | The `omni-hud` plugin draws the band above the prompt. Covers: `kit/plugin-hud/` with its manifest, `hooks.json` naming the module, and `register.tsx`; `omni now --json` run at session start, after tool calls (at most every 10 seconds) and every 30 seconds; the three rows with `Link` elements; hidden on no work and no headline, on a failed command and on bad JSON; `/omni:hud` off and on across sessions; listed in the marketplace beside `omni`; the release stamping its version with `omni`'s; its tests run by `claude plugin test` and kept out of vitest | `kit/plugin-hud/` `.claude-plugin/marketplace.json` `kit/release/` `kit/test/plugin.test.ts` `vitest.config.ts` | s1 | 2 |
| s7 | `omni init` turns the band on, and this repository shows it. Covers: `"omni-hud@omni-loop": true` added to `enabledPlugins` by init's settings rules (created when missing, other keys kept, anyone else's value never touched); this repository's `.claude/settings.json`; the kit README's paragraph on the HUD, `omni now` and `/omni:hud` | `kit/lib/init/` `kit/bin/init.test.ts` `.claude/settings.json` `kit/README.md` | s6 | 3 |

**Shared ground.** Several prefixes are declared by more than one slice, and the waves keep each
group apart:

- `kit/lib/now/` and `kit/bin/now.test.ts`: s1, s2, s3 and s4, in waves 1, 2, 3 and 4. Each adds
  its kind or its part to the reading s1 builds, and its cases to the same test.
- `kit/bin/omni.ts` and `kit/bin/omni.test.ts`: s2 and s3, in waves 2 and 3. Each adds its commands
  to the record's table of writers.
- `kit/lib/statusline/board-cache`: s1 and s4, in waves 1 and 4: s1 adds slice names to the board
  file, s4 adds the links file to the same refresh.
- `kit/bin/commands/statusline.ts` and `kit/bin/statusline.test.ts`: s4 and s5, in waves 4 and 5.
- s6 and s7 share nothing with s1 to s5: the plugin, the marketplace, the release, init and the
  settings are theirs alone. s6 runs beside s2 in wave 2, s7 beside s3 in wave 3.
- `kit/dist/` is built from `kit/lib/` and `kit/bin/`, never written by hand and never listed: the
  wave rebuilds it.

The ordering has reasons behind it:

- s2 follows s1: a fix is one more kind of work in the reading s1 builds.
- s3 follows s2: the headline sits above the work, and the `roadmap` record is one more kind of the
  record s2 widens.
- s4 follows s3: the links cover every kind, the roadmap's included.
- s5 follows s4: the second line draws every kind and the `fix PR open` stage that needs links.
- s6 follows s1: the band draws `omni now --json`, whose shape s1 fixes; its tests feed fixed
  answers, so it needs no later kind.
- s7 follows s6: init turns on a plugin that must exist in the marketplace.

## Per slice: done when

**s1**

- On a slice branch of a PRD whose board shows `s3` and `s4` in flight, `omni now --json` prints
  `work.kind` `prd`, its number and topic, `stage` `building`, and `s3` and `s4` with their names and
  state; the plain form prints the same in two lines.
- On `main` with a record `{ "prd": 315, "at" }` for the session, `omni now` names PRD 315.
- With every slice merged the stage reads `outbox`; with none of PRD 324's rules met, the stage is
  as PRD 324 says.
- With no PRD, `omni now --json` prints `{ "headline": null, "work": null, "doing": null }`; outside
  an installed repository it prints the same and exits 0.
- No case writes a file, runs `gh` or `git fetch`, or prints on stderr; `omni help now` prints the
  entry.

**s2**

- On `fix/login-redirect` with `.omni-loop/delivery/bugs/1180-login-redirect/` in the checkout,
  `omni now` names bug 1180 with no record; the same holds for a visual fix.
- After `omni bug 1180` in a session on `main`, the session's record is
  `{ "kind": "bug", "number": 1180, "at" }` and `omni now` names it; the same for `omni visual`, and
  for `omni dossier push <n> --kind bug` or `--kind visual`.
- A record of PRD 324's shape still reads as a PRD; a fix with no folder reads as no work.
- The recorded commands' output and exit are unchanged.

**s3**

- After `omni loop push tick --step 4 --prd 315 --action wave --result "s3 merged"` (the app
  stubbed), `loop.json` holds `last` with those values; after `omni loop push start` from a plan made
  with `--roadmap 7`, it holds `roadmap: 7`.
- With that loop live, `omni now --json` prints the headline `roadmap` 7 with `<m>/<k> merged`, the
  work PRD 315, and `doing` `step 4: wave PRD 315 · s3 merged`.
- A parked, stopped or silent loop is no headline; a `loop.json` of PRD 1139's shape reads as no last
  step and no roadmap.
- After `omni roadmap push 7` in a session with no loop, `omni now` shows roadmap 7 as the headline
  with no work.

**s4**

- After `omni statusline --refresh 315 --kind prd` (gh and the Omni page stubbed), the links file
  holds the PRD page, the feature PR and the open phase-0 PR, and `omni now --json` lists them in that
  order; a fix gets its page and its PR, and its stage reads `fix PR open`.
- After `omni roadmap push 7`, `omni now` lists the roadmap page that command printed.
- A links file missing, holding an error, or over 10 minutes old shows no links; a second refresh
  under the lock exits 0 and writes nothing.

**s5**

- The status line's second line reads each of the spec's six lines for the matching fixture.
- At 60 columns, a long line cuts the slice names first, then the topic; `NO_COLOR=1` prints no
  escape code.
- Line 1 is byte-for-byte what it was for every PRD 324 fixture.

**s6**

- `claude plugin validate kit/plugin-hud` passes.
- `claude plugin test kit/plugin-hud` passes cases for: three rows with links from a fixed answer; no
  band on null work and headline, on a failed command and on bad JSON; `/omni:hud` off hides the band
  and on shows it again.
- `pnpm test` collects none of `kit/plugin-hud`'s tests; the marketplace lists `omni-hud` with source
  `./kit/plugin-hud`; the release stamps both plugins' versions; `kit/test/plugin.test.ts` still
  passes.

**s7**

- `omni init` on a fresh fixture repository writes `"omni-hud@omni-loop": true` in
  `enabledPlugins`, keeps every other key, and leaves a `false` set by someone else as it is.
- This repository's `.claude/settings.json` enables `omni-hud@omni-loop`.
- The kit README says what the band shows, how to hide it with `/omni:hud`, and what `omni now`
  prints.
