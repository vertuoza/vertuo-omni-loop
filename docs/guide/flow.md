---
title: Repository flow
description: Rules, areas and hooks that tailor the loop to one repository — checked by the CLI, followed by any agent, and never a way around the loop's guards.
---

Out of the box the loop works the same way in every repository: `/omni:do-work` runs your preflight,
`/omni:wave` squash-merges every sub-PR, `/omni:pr` opens every pull request with `gh pr create`. A
team with its own habits (a database migration is one file in one pull request, the kernel lands
first, a person approves every kernel change, the tests run through its own script) used to have
only the playbook forms to say so, and a form is prose nothing checks.

The **flow** is where a repository says how the loop differs here, in the `flow` section of
`.omni-loop/config.yml`. It has three parts, and none of them is code:

- **Rules** are data the CLI checks: `omni plan check` grades the plan against them before anything
  is built, and `omni flow check merge` holds every sub-PR to them before the wave merges it.
- **Areas** give a part of the code its own rules: `src/kernel/` and `database/migrations/` need not
  follow the rules of the rest.
- **Hooks** are Markdown files an agent follows at a named point of a skill, before the kit's step,
  after it, or, at a few points, in its place.

A repository with no `flow` key works exactly as before. Nothing on this page applies to it.

## The worked example: a kernel and its migrations

A PHP repository has a kernel every other part depends on, and database migrations its deploy runs
in a job of their own. It wants:

- every sub-PR green on `phpunit` before it merges;
- kernel slices small (five paths at most), kept apart from other code, built first, with every other
  slice waiting on them, green on `phpstan-max` too and approved by a person;
- the kernel's tests run its own way, with static analysis on the slice's territory;
- a migration alone in its slice (one file) and in its landing ([Landings](/docs/landings)).

```yaml file=.omni-loop/config.yml
flow:
  rules:                                  # the default area: every path no area below claims
    subPr: { requireChecks: [phpunit] }
  areas:                                  # first match wins, in this order
    kernel:
      paths: ['^src/kernel/']
      rules:
        plan:
          - slice: { alone: true, maxFiles: 5 }
          - wave: first
          - blocks: all
        subPr: { requireChecks: [phpstan-max], approval: person }
      hooks:
        do-work.test: { replace: .omni-loop/flow/kernel/tests.md }
    migrations:
      paths: ['^database/migrations/']
      rules:
        plan:
          - slice: { alone: true, maxFiles: 1 }
          - landing: alone
```

The hook the kernel names is a Markdown file of the repository:

```markdown file=.omni-loop/flow/kernel/tests.md
---
omni-hook: do-work.test
inputs: [slice, territory]
---
Run the kernel's tests for slice {slice} only, then phpstan at level max on {territory}.
End with `omni-hook do-work.test: pass` when both are green, otherwise
`omni-hook do-work.test: fail <the first failure>`.
```

### 1. The config is checked

`omni check config` (and `omni check all`, which runs it) reads the section and every hook file it
names:

```bash terminal agent
omni check config
```

```text terminal
check config — .omni-loop/config.yml is valid; flow: 2 area(s), every hook file present.
```

It refuses, naming the key: a path pattern that does not compile, a point the catalog does not hold,
a `replace` at a point that takes none, a hook path that is absolute, holds `..`, is a URL, does not
exist or is larger than `limits.hookMaxBytes` (20480 bytes unless set), a hook under `.claude/` that
is not marked `alias: claude`, and the reserved key `flow.on`. For instance:

```text terminal
check config — the config does not hold what it claims:
  .omni-loop/config.yml is not a valid Omni Loop config: flow.areas.kernel.hooks.plan.slice.replace: plan.slice takes before and after hooks only: its act is never replaced
  flow.areas.kernel.hooks.do-work.test: .claude/hooks/tests.md sits under .claude/ — mark it { path: .claude/hooks/tests.md, alias: claude }, or move it out of .claude/
```

### 2. The plan is refused, then green

A PRD adds a `total` to quotes. Its first plan mixes the migration with code, and puts the kernel
change in wave 2:

```markdown file=plan.md
| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | a quote's total is stored | `database/migrations/2026_10_06_add_total.php` `src/Quote/Quote.php` | — | 1 |
| s2 | the bus carries the total | `src/kernel/Bus/` | s1 | 2 |
| s3 | the screen shows the total | `src/Ui/Quote/` | s1 | 2 |
```

`/omni:plan` grades every plan with `omni plan check`, and this one is refused, each line naming the
slice, the area and the rule:

```text terminal
omni plan check — PRD 42: violation(s):
  flow: s1 touches database/migrations/2026_10_06_add_total.php (area migrations) and also src/Quote/Quote.php — migrations: slice alone, a slice of this area touches no path outside it.
  flow: s1 touches 2 paths — migrations: slice maxFiles 1, at most 1 path in a slice of this area.
  flow: s2 (wave 2) touches area kernel and does not sit before s1 (wave 1), which does not — kernel: wave first, the area's slices sit in a wave before every other slice.
  flow: s2 (wave 2) touches area kernel and does not sit before s3 (wave 2), which does not — kernel: wave first, the area's slices sit in a wave before every other slice.
  flow: s1 is blocked by no slice of area kernel (s2), directly or through another — kernel: blocks all.
  flow: s3 is blocked by no slice of area kernel (s2), directly or through another — kernel: blocks all.
  landing: s1 (landing 1) touches database/migrations/2026_10_06_add_total.php, which lands alone (area migrations), and also src/Quote/Quote.php — a slice touching a land-alone path touches nothing else.
```

The corrected plan lands the kernel first, the migration alone after it, then the code. A slice in a
later landing already waits for every slice of the landings before it, so `blocks: all` holds
without a `blocked by`:

```markdown file=plan.md
| id | slice | territory | blocked by | wave | landing |
| --- | --- | --- | --- | --- | --- |
| s1 | the bus carries the total | `src/kernel/Bus/` | — | 1 | 1 |
| s2 | the column exists | `database/migrations/2026_10_06_add_total.php` | — | 1 | 2 |
| s3 | a quote's total is stored | `src/Quote/Quote.php` | — | 1 | 3 |
| s4 | the screen shows the total | `src/Ui/Quote/` | s3 | 2 | 3 |
```

```text terminal
omni plan check — 3 landings, merged in order:
  landing 1 (landing-1): wave(s) 1 — s1
  landing 2 (landing-2): wave(s) 1 — s2
  landing 3 (landing-3): wave(s) 1, 2 — s3, s4
omni plan check — PRD 42: 4 slice(s), all territories and blocks well-formed.
```

### 3. `omni flow show`: what is different here

With no argument, it prints what this repository changes from the kit's defaults, area by area, so a
person sees at a glance how the loop differs here. An area lists the rules it inherits too:

```bash terminal agent
omni flow show
```

```text terminal
flow — what this repository changes from the kit's defaults

default  every path no area claims
  rule  requireChecks phpunit

kernel  ^src/kernel/
  rule  slice alone
  rule  slice maxFiles 5
  rule  wave first
  rule  blocks all
  rule  requireChecks phpunit, phpstan-max
  rule  approval person
  hook  do-work.test replace .omni-loop/flow/kernel/tests.md

migrations  ^database/migrations/
  rule  slice alone
  rule  slice maxFiles 1
  rule  landing alone
  rule  requireChecks phpunit
```

With `--path`, the area one path belongs to, with every rule and hook there:

```bash terminal agent
omni flow show --path src/kernel/Bus/Dispatcher.php
```

```text terminal
path     src/kernel/Bus/Dispatcher.php
area     kernel  ^src/kernel/
rules    slice alone · slice maxFiles 5 · wave first · blocks all · requireChecks phpunit, phpstan-max · approval person
hook     do-work.test replace .omni-loop/flow/kernel/tests.md
```

### 4. A hook at its point

Each skill calls `omni flow show <point>` at each of its points and follows what it prints. For the
kernel slice s1, at `do-work.test`, the kernel's hook takes the kit's step, its inputs filled in:

```bash terminal agent
omni flow show do-work.test --prd 42 --slice s1
```

```text terminal
point    do-work.test
areas    kernel
territory src/kernel/Bus/
replace  .omni-loop/flow/kernel/tests.md  (kernel)
kitStep: replaced
verdict  omni-hook do-work.test: pass | omni-hook do-work.test: fail <why>

## replace .omni-loop/flow/kernel/tests.md (kernel)
Run the kernel's tests for slice s1 only, then phpstan at level max on src/kernel/Bus/.
End with `omni-hook do-work.test: pass` when both are green, otherwise
`omni-hook do-work.test: fail <the first failure>`.
```

The agent does what the hook says, writes its output to a file with the verdict line last, and hands
it back:

```bash terminal agent
omni flow verdict do-work.test --from out.txt
```

It prints `ok`, or `not ok do-work.test <why>` and exits `1`. Output whose last line is not that
point's verdict is `not ok do-work.test no verdict`: a hook that forgets to say how it went has not
passed. A slice of `src/Quote/` meets no hook at the same point, and the kit's step runs:
`kitStep: run`.

### 5. The merge gate

Before `/omni:wave` merges a sub-PR it asks the gate, which reads the sub-PR's checks, reviews and
diff from GitHub and applies the `subPr` rules of every area the slice's territory and its diff
touch:

```bash terminal agent
omni flow check merge --pr 12
```

```text terminal
not ok kernel: approval person — no person has approved #12
```

Once a person approves and both checks are green, the gate prints `ok` and the one command the wave
runs, never one written by hand:

```text terminal
ok
gh pr merge 12 --squash --delete-branch
```

A refused sub-PR stays open as it is; the next wave run asks the gate again.

## Rules

**`rules.plan`**, graded by `omni plan check` on each slice's territory:

| rule | holds when |
|---|---|
| `slice: { alone: true }` | a slice touching the area touches no path outside it |
| `slice: { maxFiles: <n> }` | a slice lists at most n paths in its territory |
| `wave: first` | the area's slices sit before every other slice, by landing then by wave |
| `blocks: all` | every other slice lists one of the area's slices in `blocked by`, directly or through another slice, or sits in a later landing |
| `landing: alone` | the landing rule of [Landings](/docs/landings), for this area: a slice touching it touches nothing else, and its landing holds only such slices |

**`rules.subPr`**, applied by `omni flow check merge`:

| rule | default | what it does |
|---|---|---|
| `merge: squash \| merge \| rebase` | `squash` | the merge method in the command it prints |
| `requireChecks: [<name>]` | none | these checks are green: passed, skipped or neutral |
| `approval: person` | none | a person approved the sub-PR, in their latest review; a bot never counts |
| `territory: report \| block` | `report` | a changed path outside the slice's territory is reported, or refuses the merge |
| `maxOpen: <n>` | none | at most n of the area's sub-PRs open into the same branch at once |

Whatever the rules say, a sub-PR into the default branch, or one that is not open, never merges.

## Areas

- `areas.<name>.paths` is a list of regular expressions over repository paths. A path belongs to the
  **first** area, in the order written, whose patterns match it; otherwise to the default area, the
  root of `flow`. An area is named by one kebab-case word, never `default`.
- **A slice belongs to every area its territory touches**, and the merge gate adds the areas its diff
  reaches.
- **An area inherits** the default area's rules and hooks, unless it says `inherit: false`. Inherited
  or combined across a slice's areas: a limit keeps the strictest value, `requireChecks` is the
  union, `approval: person` and `territory: block` in one area apply to the whole slice. An area's
  own `merge` wins over the default's; only an area with `inherit: false` can loosen a limit.
- **Conflicts are split, never settled.** A slice meeting two `merge` methods, or two areas' `replace`
  hooks at one point, is refused by `omni plan check`, naming both areas: split the slice.
- `areas.<name>.knowledge` names a domain folder of the knowledge base that `/omni:plan` reads for the
  area's slices.

## Hooks

### The points

A point is `<skill>.<step>`, named after the base skill: `/omni:ultra-wave` fires `wave.merge`
because it follows `/omni:wave` step for step. The catalog is the one list of points, and a test
keeps every skill it names calling `omni flow show` there.

| point | fires in | before, after | replace | a replace must produce |
|---|---|---|---|---|
| `plan.slice` | `/omni:plan`, once per slice drafted (also `/omni:mega-brainstorm`) | ✓ | — | — |
| `plan.done` | `/omni:plan`, once its pull request is open | ✓ | — | — |
| `do-work.start` | `/omni:do-work`, before anything is built | ✓ | — | — |
| `do-work.test` | `/omni:do-work`, each time the slice's tests run | ✓ | ✓ | the verdict line |
| `do-work.review` | `/omni:do-work`, its review of the slice | ✓ | — | — |
| `do-work.ready` | `/omni:do-work`, before the sub-PR is handed off | ✓ | — | — |
| `pr.open` | `/omni:pr`, opening a feature, landing or standalone pull request | ✓ | ✓ | the PR's URL as its last line before the verdict |
| `wave.merge` | `/omni:wave`, `/omni:ultra-wave`, after an `ok` gate | ✓ | ✓ | the merged PR's number in the verdict |
| `yolo.ready` | `/omni:yolo`, `/omni:ultra-yolo`, before the feature PR is marked ready | ✓ | — | — |

### How a point runs

Each point takes `{ before: <path or list>, after: <path or list>, replace: <path> }`; a bare path is
`after`. At the point the skill follows every `before`, then the kit's step or the `replace` hook,
then every `after`. Across areas, extend hooks add up (the default area's first, then each area's in
the order written), and an area's own `replace` wins over the default area's.

### Replace the act, never the guard

**Extend is the default; replace is the exception.** A playbook form only adds to a skill
(ADR-0025), and so do `before` and `after` hooks. A `replace` hook takes the kit's act at the three
points the catalog allows, and nothing more (ADR-0069). These run whatever the hooks say: signing,
labels, the PR links, the base check (never into the default branch), the territory check,
`omni plan check`, the slice's preflight before it ships, and the merge gate.

### A hook file

A hook is a Markdown file of the repository, named by its path from the root. It may open with a
short front matter (fenced in `---`, or as its first `key: value` lines): `omni-hook: <point>`, the
`inputs` it reads, its `verdict`. `{name}` in its text is filled with that input: `{prd}`, `{slice}`,
`{territory}`, `{branch}` at the do-work points, `{base}`, `{head}`, `{title}` at `pr.open`. Its
output ends with `omni-hook <point>: pass` or `omni-hook <point>: fail <why>`.

The loop **fails closed**: a broken `flow`, a missing hook file or a missing verdict stops the point;
nothing is skipped silently.

### Not tied to one agent

Nothing under `flow` names a Claude path, a slash command or a Claude tool. `omni flow show <point>
--json` is self-sufficient: any agent that knows nothing of the kit follows it. A hook that only
Claude Code can read is marked as such, `{ path: <path>, alias: claude }`, and is the only kind
allowed under `.claude/`.

## The two older keys

The two keys of [Landings](/docs/landings) keep working, and read as flow:

| key | reads as |
|---|---|
| `landings.alone: [<re>]` | one more area, checked after every named one, with those paths and `landing: alone` |
| `pr.openWith: /create-pr` | the default area's `pr.open` `replace` hook, marked `alias: claude` (a Claude-only command); like the key, it opens feature, landing and standalone pull requests, never sub-PRs |

## Several repositories

In a plan repository ([Several repositories](/docs/several-repositories)), each target's flow is
read where it is safe to read it:

| when | the target's flow is read from |
|---|---|
| `/omni:mega-invade` | it copies the target's `flow`, `landings` and `pr` keys to `repos/<name>/flow/config.yml` in the knowledge folder, and each hook file at its own path under that `flow/` folder |
| `/omni:mega-brainstorm`, `omni plan check` | that copy: each `repo: <name>` row is graded against that target's areas and rules; a target with no copy meets the kit's defaults |
| `omni flow show --repo <name>` | that copy |
| `/omni:ultra-wave`, `/omni:do-work --target`, `pr.open`, `wave.merge` in a target | the target's own committed config, in its clone, never the copy |
| `/omni:ultra-yolo`, at its start | `omni targets` reports a target whose flow moved since it was copied as stale, `flow moved since read at`, and the run raises it as a decision |

A target's hook is followed only in that target's clone, never from the imported copy.

## Proposed by `/omni:invade`

When `/omni:invade` finds a migrations folder, it proposes a `migrations` area with
`slice: { alone: true }` and `landing: alone` in its config commit, as a proposal a person merges or
drops. It never applies a flow, and never writes a hook.

## The keys

| key | default | what it does |
|---|---|---|
| `flow.rules` | none | the default area's `plan` and `subPr` rules |
| `flow.hooks` | none | the default area's hooks, by point |
| `flow.areas.<name>` | none | an area: `paths`, `rules`, `hooks`, `knowledge`, `inherit` |
| `flow.on` | refused | reserved for events, which a later PRD defines |
| `limits.hookMaxBytes` | `20480` | the largest a hook file may be |

[Next → Validate with e2e (beta)](/docs/validate-e2e)
