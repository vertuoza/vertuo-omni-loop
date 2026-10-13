# ADR-0103 — The repository that receives a slice asks for its contract declaration, in its own words

**Status:** accepted · **Date:** 2026-10-13 · **PRD:** #1870

## Context

A plan commits a repository to a contract before a line of code exists: a GraphQL type or field, a
REST route, a database migration. The slice table said nothing about it in a form a machine reads;
what a slice changes for its callers sat in the "done when" prose. The plan repository
`vertuoza/vertuo-automation-plan` built a gate that holds a plan committing `vertuo-backend-php` to
a contract change until the back end's owners approve it, reading a `contract` column the plan skill
never wrote: its header row was "exactly" the kit's five columns, and a playbook form cannot override
a skill's rule. Every back-end slice of every plan was held, with no way to say "this slice changes
nothing for its callers".

## Decision

1. **The declaration lives in the plan:** a `contract` column of the slice table, read by name. Its
   cell holds one or more of the receiving repository's kinds, comma-separated, or `none`; an empty
   cell or an em dash declares nothing. `none` is explicit, so a gate can tell a decision from an
   oversight.
2. **The repository that receives the slice asks, in its own config:**
   `contracts: { declare: true, kinds: [...] }`. `declare` is `false` by default; `kinds` defaults
   to `[api, db]` (`api` a GraphQL schema or a REST route or payload, `db` a migration or a stored
   shape) and a repository names its own when its callers depend on something else. Never the plan
   repository: it lists nothing.
3. **`omni plan check` refuses**, naming the slice, wherever the receiving repository asks: a cell
   that declares nothing and a word outside that repository's kinds. Wherever the slice sits, it
   refuses `none` beside a kind. A repository that asks nothing has its cells checked for that form
   only. `/omni:plan` writes the column from the line `omni flow show` prints.
4. **A plan repository reads a target's ask from the target's copied planning config,**
   `repos/<name>/flow/config.yml`, which `/omni:mega-invade` now writes for every target, whatever
   its `knowledge`.

## Alternatives

- **Paths** (a slice touching `src/graphql/` changes the API): rejected. At plan level a territory
  cannot tell a schema change from a behaviour change, and nearly every back-end slice touches one.
- **A mark on the done-when heading,** like `ui: yes`: rejected. `omni plan check` does not read
  those marks, and a gate would parse prose.
- **A list of repositories in the plan repository's config:** rejected. The plan repository would
  decide for a target it does not own.
- **A closed vocabulary in the kit** (`schema`, `rest`, `db`): rejected. Every new kind would wait
  for a kit release, and the kit would hold one consumer's words.
- **Switching a target such as `vertuo-backend-php` to `imported`** so its config travels: rejected.
  It would put a draft of its knowledge base in the plan repository, which `own` exists to avoid.

## Consequences

- **Every target's planning config is copied,** `own` and `none` included, and only that folder:
  `flow/` holds config and the hook files it names, nothing a person wrote. A target's flow areas and
  `landings.alone` therefore reach the plan repository's `omni plan check` for the first time too;
  a plan that already breaks them goes red at its next check.
- `omni targets` compares every target's committed planning config with its copy and reports a
  missing one as `stale (flow not copied …)`; `/omni:mega-invade --sync` redraws it. `omni plan
  check` stays silent on a missing copy and grades with the kit's defaults, so no plan repository
  goes red the day the kit updates.
- A repository that renames or drops a kind turns plans written with the old word red at their next
  check; the planner rewrites the cell.
- Nothing else in the kit acts on the declaration. `Slice` carries it for downstream readers; a check
  that a built sub-PR honours it is left to a later PRD.
