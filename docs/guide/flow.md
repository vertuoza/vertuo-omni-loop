---
title: Repository flow
description: Rules, areas, hooks and landings that tailor the loop to one repository — checked by the CLI, followed by any agent, and never a way around the loop's guards.
---

Out of the box the loop works the same way in every repository: `/omni:do-work` runs your preflight,
`/omni:wave` squash-merges every sub-PR, `/omni:pr` opens every pull request with `gh pr create`. A
team with its own habits (a database migration is one file in one pull request, the kernel lands
first, a person approves every kernel change, the tests run through its own script) could say so in the playbook forms, but a form is prose
nothing checks.

The **flow** is where a repository says how the loop differs here, in the `flow` section of
`.omni-loop/config.yml`. It has three parts, and none of them is code:

- **Rules** are data the CLI checks: `omni plan check` grades the plan against them before anything
  is built, and `omni flow check merge` holds every sub-PR to them before the wave merges it.
- **Areas** give a part of the code its own rules: `src/kernel/` and `database/migrations/` need not
  follow the rules of the rest.
- **Hooks** are Markdown files an agent follows at a named point of a skill, before the kit's step,
  after it, or, at a few points, in its place.

A PRD can also reach the default branch in several ordered pull requests, its **landings**, so a
database migration ships alone, before the code that reads it ([Landings](#landings)).

A repository with no `flow` key works the default way. Nothing on this page applies to it.

## The worked example: a kernel and its migrations

A PHP repository has a kernel every other part depends on, and database migrations its deploy runs
in a job of their own. It wants:

- every sub-PR green on `phpunit` before it merges;
- kernel slices small (five paths at most), kept apart from other code, built first, with every other
  slice waiting on them, green on `phpstan-max` too and approved by a person;
- the kernel's tests run its own way, with static analysis on the slice's territory;
- a migration alone in its slice (one file) and in its landing ([Landings](#landings)).

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
  flow.areas.kernel.hooks.do-work.test: .claude/hooks/tests.md sits under .claude/, which only Claude Code reads — move it to .agents/hooks/, or mark it { path: .claude/hooks/tests.md, alias: claude }
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
modes    before, after, replace
inputs   prd, slice, territory, branch
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

Before `/omni:wave` merges a sub-PR it handles the sub-PR's review threads (`omni care state <n>
--pr 12`, as [the loop](./loop.md#slices-and-waves) says), then asks the gate, which reads the sub-PR's checks, reviews and
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
| `landing: alone` | the landing rule of [Landings](#landings), for this area: a slice touching it touches nothing else, and its landing holds only such slices |

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

## Landings

A PRD normally reaches your default branch in one pull request: the feature PR. That is wrong when
part of the change must be **deployed apart** from the rest. The usual case is a database migration:
if the migrations run in their own deployment job before the service, a migration must work without
the code that will use it, and the code must be able to roll back while the schema stays. So the
migration ships in its own pull request, merged and deployed first, and the code follows.

A **landing** is one branch with its own pull request into the default branch, stacked on the
landing before it. Inside a landing nothing changes (slices, sub-PRs, waves, territories, the
preflight). The loop builds the landings in order, and a person merges them in order. A PRD with no
landings has one, and nothing in this section applies to it.

### In the plan

The slice table gains a `landing` column, as in the corrected plan of the worked example above, and
an optional `## Landings` table names each landing and what must be true before it is merged. A
column added, then made required, lands in three steps:

```markdown file=plan.md
## Landings

| landing | name | merge when |
| --- | --- | --- |
| 1 | expand | — |
| 2 | code | landing 1 is deployed |
| 3 | contract | landing 2 is deployed |
```

`omni plan check` holds these rules:

- **Landing numbers run from 1 with no gap.** A plan using landings 1 and 3 is refused, naming
  landing 2.
- **Waves are counted within a landing.** A slice's wave is 1 with no blockers, else one more than
  its highest blocker's, and every blocker is in the same landing.
- **No blocker crosses a landing.** A landing waits for the one before it by its order alone; a
  `blocked by` naming a slice of another landing is refused.
- **Territories collide only within a landing.** Two slices of different landings may share a
  directory: they never run side by side.
- **The `## Landings` table names exactly the landings the slices use.** Without the table, each
  landing is named `landing-<n>`, with no merge condition. A name is kebab-case: it goes into the
  branch and the title.

`omni plan check <n>` prints one line per landing, with its name, its waves and its slices. Whether
a path must land alone is a rule of its area, `landing: alone` ([Rules](#rules)). The finer cut (one
expand landing, one landing per large backfill, one contract landing) is advice in the repository's
releasing form (`omni kb show releasing`), not a check.

### Branches and pull requests

When the plan is green, `/omni:plan` reads the chain with `omni plan landings <n> --json` and opens
it:

- **One branch per landing**, from `branches.landing` (default
  `feat/{topic}-{landing}of{landings}-{name}`): landing 1 cut from the default branch, landing n from
  landing n-1's branch, such as `feat/quote-total-1of3-expand`, then `…-2of3-code`, then
  `…-3of3-contract`.
- **One draft pull request per landing**: landing 1 into the default branch, landing n into landing
  n-1's branch, so each diff shows only its own landing. Each title ends with ` (n/N)`.
- **Each body** lists its own slices, then a `## Landings` overview of every landing PR with its
  state and merge condition, and, from landing 2 on, the line *Merge after landing n-1 (name) is
  deployed.*

The merge and the deployment are two moments. The loop gates on the merge, because GitHub can tell
it; the body carries the deployment reminder, because only a person knows when the deploy ran. For
a contract migration that gap is the whole point.

### Building and merging

`/omni:yolo` builds the **current landing** (the first whose slices are not all merged; `omni board
<n>` names it) through its waves, finishes it, runs the outbox gate on its branch, then moves on to
the next landing **without waiting** for anyone to merge the first: landing 2 is built on landing
1's branch, so its code and its tests run against the new schema.

**The ready rule.** Landing n's PR is marked ready only when every slice of landing n is merged into
its branch, its gate and its CI are green, and landing n-1's PR is **merged**, checked on GitHub. A
landing finished while the one before it is still open stays in draft, its status comment says
which merge it waits for, and a later run marks it ready. `omni ship`, which moves the PRD's folder
to the shipped folder, runs once, on the last landing. While you wait, `omni board <n>` shows each
landing's PR as draft, ready or merged, and `omni status` lists your PRD's landings with the merge
each waits for.

When landing n merges, `/omni:pr-care` keeps the stack straight: it checks that GitHub retargeted
landing n+1's PR onto the default branch (GitHub does so only when the merged branch was deleted)
and retargets it otherwise, rebases landing n+1's branch onto the default branch past landing n's
own commits, pushes, and does the same down the chain. A rebase conflict stops the chain at that
landing and is reported, never resolved blindly.

In a plan repository a landing may span targets, and each target gets **its own chain**: only the
landings with a slice there, numbered within it. If landing 1 holds the back-end's migration and
landing 2 the back-end's code and the front-end's screen, the back-end gets two stacked PRs, `(1/2)`
and `(2/2)`, and the front-end gets a single PR with no suffix. A target's landing PR is marked
ready once the previous landing **in that target** is merged; one target never waits on another's.

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
| `bug-fix.reproduce` | `/omni:bug-fix` step 7 before the reproduction is written, and `/omni:mega-bug-fix` in each target; handed `{issue}`, `{branch}`, `{suspect}`, `{boundary}` | ✓ | — | — |
| `bug-fix.review` | `/omni:bug-fix` after the guard and before mutation, and `/omni:mega-bug-fix` in each target; handed `{issue}`, `{branch}`, `{base}` | ✓ | — | — |
| `bug-fix.proof` | `/omni:bug-fix` step 12, once the draft pull request holds the fix, and `/omni:mega-bug-fix` once, in the target where the bug shows, after every target's pull request holds its fix (`{targets}` hands it all of them, and the record's pull request carries the proof); handed `{issue}`, `{base}`, `{head}`, `{pr}`, `{targets}`, `{reproduction}`, `{out}` | ✓ | ✓ | `before.*` and `after.*` in `{out}`, an `env:` line, the verdict line |
| `yolo.ready` | `/omni:yolo`, `/omni:ultra-yolo`, before the feature PR is marked ready | ✓ | — | — |

### How a point runs

Each point takes `{ before: <path or list>, after: <path or list>, replace: <path> }`; a bare path is
`after`. At the point the skill follows every `before`, then the kit's step or the `replace` hook,
then every `after`. Across areas, extend hooks add up (the default area's first, then each area's in
the order written), and an area's own `replace` wins over the default area's.

### Replace the act, never the guard

**Extend is the default; replace is the exception.** A playbook form only adds to a skill,
and so do `before` and `after` hooks. A `replace` hook takes the kit's act at the four
points the catalog allows, and nothing more. These run whatever the hooks say: signing,
labels, the PR links, the base check (never into the default branch), the territory check,
`omni plan check`, the slice's preflight before it ships, and the merge gate.

### A hook file

A hook is a Markdown file of the repository, named by its path from the root. It may open with a
short front matter (fenced in `---`, or as its first `key: value` lines): `omni-hook: <point>`, the
`inputs` it reads, its `verdict`. `{name}` in its text is filled with that input: `{prd}`, `{slice}`,
`{territory}`, `{branch}` at the do-work points, `{base}`, `{head}`, `{title}` at `pr.open`, `{issue}`, `{branch}`, `{suspect}`, `{boundary}` at `bug-fix.reproduce`, `{issue}`, `{branch}`, `{base}` at `bug-fix.review`, `{issue}`, `{base}`, `{head}`, `{pr}`, `{targets}`, `{reproduction}`, `{out}` at `bug-fix.proof`. Its
output ends with `omni-hook <point>: pass` or `omni-hook <point>: fail <why>`.

The loop **fails closed**: a broken `flow`, a missing hook file or a missing verdict stops the point;
nothing is skipped silently.

### Not tied to one agent

Nothing under `flow` names a Claude path, a slash command or a Claude tool. `omni flow show <point>
--json` is self-sufficient: any agent that knows nothing of the kit follows it. Put hook files under
`.agents/hooks/`, the folder several agents share: a hook there is a plain path, with no alias. A
hook that only Claude Code can read is marked as such, `{ path: <path>, alias: claude }`, and is the
only kind allowed under `.claude/`.

## The two older keys

Two keys came before `flow`. They keep working, and read as flow:

| key | reads as |
|---|---|
| `landings.alone: [<re>]` | one more area, checked after every named one, with those paths and `landing: alone` |
| `pr.openWith: /create-pr` | the default area's `pr.open` `replace` hook, marked `alias: claude` (a Claude-only command); like the key, it opens feature, landing and standalone pull requests, never sub-PRs |

With `pr.openWith` set, the skill is called as
`/create-pr --base <branch> --draft --non-interactive --prd <owner/repo>#<n>`, plus `--landing <n>/<N>`
for a PRD of several landings and `--issue #<n>` when there is one. It prints the pull request's URL
as its last line; the loop then adds its own lines (the link line, the slices, the landings
overview) above what the skill wrote. In a plan repository, each target's own key opens its pull
requests, in its clone.

## The external reference of a pull request

Teams that track work elsewhere name each pull request after its ticket, and a check may refuse a
title with no key. An issue carries its ticket's key in one line of its body, which GitHub does not
render (`<!-- omni-ref: <ref> -->`, as in `<!-- omni-ref: ABC-123 -->`), written by whoever files
the issue (a tool or a person; the kit never writes one).

`<ref>` is 1 to 64 letters, digits, `.`, `_` or `-`; the first valid marker counts, and a line of
another shape is skipped. The repository says how the key reads in its config, under `pr.ref`
(`null` by default, and then nothing changes):

```yaml file=.omni-loop/config.yml
pr:
  ref:
    title: "[{ref}]-{title}"                 # must hold {ref} and {title}
    none: "[NoRef]-{title}"                  # with no marker; null: the title is left as it is
    link: "https://tracker.example/{ref}"    # null: no link line; must hold {ref}, https://
```

`omni ref <issue> --title "<title>"` reads the issue through `gh` and prints `title:` (formatted, and
unchanged when it already reads as the format) and `link:` (or `none`); `--json` prints
`{ ref, title, link }`. An issue it cannot read exits 1 with one line, and the pull request then opens
with its title unchanged.

A pull request opened in another repository (`/omni:pr --repo`, from `/omni:mega-bug-fix` or
`/omni:ultra-yolo`) takes that repository's format: `omni ref <issue> --title "<title>" --repo <owner/name>`
reads the marker on this repository's issue and formats with the `pr.ref` the other repository
commits on its default branch. A repository that commits no config, or no `pr.ref`, leaves the title
as it is; a config `gh` cannot read, or that does not read, exits 1 with one line.

`/omni:pr` runs it at point `pr.open` for a feature, landing or standalone pull request that has an
issue, never for a sub-PR. With no `replace`, the printed title goes to `gh pr create`. With a
`replace` (or `pr.openWith`), the skill opens the pull request as usual, then `/omni:pr` sets the
title with `gh pr edit <n> --title` when it differs, the skill's own title being the `{title}`. The
`link` joins Omni's lines at the top of the body.

## Contracts

A plan commits a repository to a contract before a line of code exists: a GraphQL field, a REST
route, a migration. A repository whose callers depend on that can ask every plan to say so, slice by
slice, in its own config:

```yaml file=.omni-loop/config.yml
contracts:
  declare: true
  kinds: [api, event]   # optional; [api, db] when absent
```

Then `/omni:plan` gives the slice table a `contract` column, after `territory`, and writes in each
slice's cell what it changes for the repository's callers: one or more of the repository's kinds,
comma-separated (`api`, `api, event`), or `none` when it changes nothing for them. `none` is a
decision, not a blank: a gate downstream (a check that holds a pull request for the API's owners,
say) can tell it from an oversight. The column is read by name, so its place in the row is free.

```markdown file=plan.md
| id | slice | territory | contract | blocked by | wave |
| --- | --- | --- | --- | --- | --- |
| s1 | The order total is a field of the API | `src/graphql/` | api | — | 1 |
| s2 | The order page shows the total | `src/pages/order/` | none | s1 | 2 |
```

The kinds are the repository's words, never the kit's: a back end names an API and a database, a
worker its events, a library its exports. With no `kinds`, they are `api` (a GraphQL type, field or
argument, or a REST route or payload) and `db` (a migration or a stored shape). Each is one lowercase
word; `none` is never one of them, and the list is never empty and never names a word twice.

`omni plan check` refuses, naming the slice, wherever the receiving repository asks:

```text terminal
s2: contract: declares nothing — api, event or none
s3: contract: "graphql" is no kind of this repository — api, event or none
```

and, wherever the slice sits, asked or not:

```text terminal
s4: contract: "none" beside a kind — one or the other
```

A repository that asks nothing has no list to check words against: a slice there may carry the
column, and only its form is checked. A green plan prints its declared contracts after the waves,
`contracts: s1 api`, and `omni flow show` prints the ask on a line of its own, `contracts: declare
api, event` or `contracts: none`.

**The before/after page shows each contract.** A declared kind is a commitment the people reviewing
the PRD must be able to see, so the PRD's `before-after.html` carries one block per declared kind,
today beside after, headed by the kind and the repository (`Contract: db — back`) and marked
`data-contract="<kind>"`: for `db` the tables and their columns, for a GraphQL schema its types,
fields and mutations, for a REST or API kind the endpoints and their payloads. `/omni:brainstorm`
writes the blocks from the spec, `/omni:plan` adds one the plan declares and the page lacks, and
`omni plan check` reads the page beside the plan and refuses, where the repository asks, each declared
kind without its block:

```text terminal
s1: contract: db — before-after.html has no data-contract="db" block
s2: contract: api — the folder has no before-after.html to carry its data-contract="api" block
```

The phase-0 check on the Omni app grades the same way. Nothing else in the loop acts on the
declaration: it is there for the people reviewing the plan and for a gate a repository builds on it.

| key | default | what it does |
|---|---|---|
| `contracts.declare` | `false` | `true` asks every slice landing in this repository to declare its contract |
| `contracts.kinds` | `[api, db]` | the words a slice may declare here, besides `none` |

## Several repositories

In a plan repository ([Several repositories](/docs/several-repositories)), each target's flow is
read where it is safe to read it:

| when | the target's flow is read from |
|---|---|
| `/omni:mega-invade` | for every target, `own` and `none` included, it copies the target's `flow`, `landings`, `pr` and `contracts` keys to `repos/<name>/flow/config.yml` in the knowledge folder, and each hook file at its own path under that `flow/` folder |
| `/omni:mega-brainstorm`, `omni plan check` | that copy: each `repo: <name>` row is graded against that target's areas, rules and contracts; a target with no copy meets the kit's defaults and is asked no contract |
| `omni flow show --repo <name>` | that copy |
| `/omni:ultra-wave`, `/omni:do-work --target`, `pr.open`, `wave.merge` in a target | the target's own committed config, in its clone, never the copy |
| `/omni:ultra-yolo`, at its start | `omni targets` reports a target whose flow moved since it was copied as stale, `flow moved since read at`, or one that commits a flow with no copy, `flow not copied`, and the run raises it as a decision |

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
| `flow.on` | refused | reserved for events, in a later version of the kit |
| `contracts.declare` | `false` | every slice landing here declares its contract ([Contracts](#contracts)) |
| `contracts.kinds` | `[api, db]` | the kinds a slice may declare here, besides `none` |
| `limits.hookMaxBytes` | `20480` | the largest a hook file may be |
| `branches.landing` | `feat/{topic}-{landing}of{landings}-{name}` | the branch of each landing of a PRD of more than one ([Landings](#landings)) |
| `landings.alone` | `[]` | an older key: paths that land alone ([The two older keys](#the-two-older-keys)) |
| `pr.openWith` | `null` | an older key: the skill that opens pull requests into the default branch |

[Next → Design craft (opt-in)](/docs/design)
